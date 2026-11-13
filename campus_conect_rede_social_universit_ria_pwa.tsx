import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Home,
  Search,
  Bell,
  Mail,
  User,
  Plus,
  Heart,
  Repeat2,
  MessageCircle,
  Bookmark,
  Share2,
  MoreHorizontal,
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Sun,
  Moon,
  Download,
  Database,
  LogOut,
  CheckCircle2,
  Sparkles,
  GraduationCap,
  MapPin,
  Calendar,
  X,
  Trash2,
  Settings,
  ShieldCheck,
  Smartphone,
  Share,
  MoreVertical,
  Copy,
  Check,
  TrendingUp,
  Users,
  Edit3,
  ExternalLink,
  AlertCircle,
  Loader2,
  KeyRound
} from 'lucide-react';

// ============================================================================
// 1. SUPABASE SQL SCHEMA & RLS POLICIES (EXPORTABLE IN SETTINGS)
// ============================================================================
const SUPABASE_SQL_SCHEMA = `-- ============================================================================
-- CAMPUS CONECT - SCHEMA POSTGRESQL + RLS + STORAGE (SUPABASE)
-- ============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE PERFIS (PROFILES)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  curso TEXT NOT NULL,
  faculdade TEXT NOT NULL,
  ano_entrada INTEGER DEFAULT 2024,
  seguidores_count INTEGER DEFAULT 0,
  seguindo_count INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE POSTS
CREATE TABLE public.posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 280),
  image_url TEXT,
  likes_count INTEGER DEFAULT 0,
  reposts_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CURTIDAS (LIKES) - Restrição única por usuário/post
CREATE TABLE public.likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- 5. REPOSTS
CREATE TABLE public.reposts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- 6. SEGUIDORES (FOLLOWS)
CREATE TABLE public.follows (
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- 7. RESPOSTAS (REPLIES)
CREATE TABLE public.replies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 280),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. NOTIFICAÇÕES (NOTIFICATIONS)
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('like', 'repost', 'reply', 'follow')) NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CONVERSAS E MENSAGENS DIRETAS
CREATE TABLE public.conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  participant_1 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. SALVOS (BOOKMARKS)
CREATE TABLE public.bookmarks (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Perfis: leitura pública, edição apenas pelo dono
CREATE POLICY "Perfis visíveis para todos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuários editam próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Usuários criam próprio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Posts: leitura pública, criação/exclusão apenas pelo autor
CREATE POLICY "Posts visíveis para todos" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Usuários criam posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Usuários deletam próprios posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- Likes, Reposts, Bookmarks, Follows
CREATE POLICY "Likes públicos" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Gerenciar próprios likes" ON public.likes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Reposts públicos" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "Gerenciar próprios reposts" ON public.reposts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Follows públicos" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Gerenciar próprios follows" ON public.follows FOR ALL USING (auth.uid() = follower_id);

CREATE POLICY "Bookmarks privados" ON public.bookmarks FOR ALL USING (auth.uid() = user_id);

-- Replies
CREATE POLICY "Replies públicas" ON public.replies FOR SELECT USING (true);
CREATE POLICY "Criar próprias replies" ON public.replies FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Notificações: apenas o destinatário vê e marca como lida
CREATE POLICY "Ver próprias notificações" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Atualizar próprias notificações" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Criar notificações" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- Conversas e Mensagens: apenas participantes
CREATE POLICY "Ver próprias conversas" ON public.conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Criar conversas" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Ver mensagens da conversa" ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  ));
CREATE POLICY "Enviar mensagens" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Storage Buckets: avatars, banners, post-images
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true) ON CONFLICT DO NOTHING;
`;

// ============================================================================
// 2. INITIAL MOCK DATA (UNIVERSITY ECOSYSTEM)
// ============================================================================
const INITIAL_PROFILES = [
  {
    id: 'user-1',
    username: 'lucas_dev',
    nome: 'Lucas Mendes',
    bio: 'Dev Fullstack & Monitor de Estrutura de Dados 💻 | Sobrevivendo à base de café do DCE e listas de Cálculo II.',
    avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=face',
    banner_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=300&fit=crop',
    curso: 'Eng. Software',
    faculdade: 'USP',
    ano_entrada: 2023,
    seguidores_count: 342,
    seguindo_count: 128,
    criado_em: '2024-02-10T10:00:00Z'
  },
  {
    id: 'user-2',
    username: 'camila_med',
    nome: 'Camila Rocha',
    bio: 'Internato chegando 🩺✨ | Representante da Atlética Medicina | Apaixonada por neurociência e plantões.',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    banner_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=300&fit=crop',
    curso: 'Medicina',
    faculdade: 'UNICAMP',
    ano_entrada: 2021,
    seguidores_count: 890,
    seguindo_count: 215,
    criado_em: '2024-01-15T14:20:00Z'
  },
  {
    id: 'user-3',
    username: 'rafa_design',
    nome: 'Rafael Costa',
    bio: 'UI/UX Designer & Ilustrador 🎨 | Diretor de Criação no Centro Acadêmico | Sempre com um iPad na mochila.',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    banner_url: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=800&h=300&fit=crop',
    curso: 'Design Digital',
    faculdade: 'UFMG',
    ano_entrada: 2022,
    seguidores_count: 512,
    seguindo_count: 304,
    criado_em: '2024-03-01T09:15:00Z'
  },
  {
    id: 'user-4',
    username: 'juliana_dir',
    nome: 'Juliana Alves',
    bio: 'Direito Constitucional & Pesquisa em Direitos Digitais ⚖️ | Extensão Universitária e Café na Biblioteca Central.',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
    banner_url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=300&fit=crop',
    curso: 'Direito',
    faculdade: 'UFRJ',
    ano_entrada: 2023,
    seguidores_count: 428,
    seguindo_count: 190,
    criado_em: '2024-02-20T16:40:00Z'
  },
  {
    id: 'user-5',
    username: 'pedro_cc',
    nome: 'Pedro Henrique',
    bio: 'IA & Visão Computacional 🤖 | Maratona de Programação SBC | Buscando estágio em Pesquisa.',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
    banner_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=300&fit=crop',
    curso: 'Ciência da Comp.',
    faculdade: 'UTFPR',
    ano_entrada: 2024,
    seguidores_count: 267,
    seguindo_count: 145,
    criado_em: '2024-04-05T11:10:00Z'
  }
];

const INITIAL_POSTS = [
  {
    id: 'post-1',
    author_id: 'user-2',
    content: 'Alguém sabe o que tem hoje no bandejão central? Se tiver strogonoff eu atravesso o campus correndo antes da aula de Semiologia! 🍛🏃‍♀️ #RUHoje #VidaUniversitaria',
    image_url: null,
    likes_count: 48,
    reposts_count: 7,
    replies_count: 2,
    created_at: new Date(Date.now() - 1000 * 60 * 24).toISOString()
  },
  {
    id: 'post-2',
    author_id: 'user-3',
    content: 'Finalizei o redesign do app da Semana Acadêmica! O que acharam da nova identidade visual com gradiente índigo e ciano? Feedbacks são super bem-vindos 🎨✨ #Design #Intercomp2026',
    image_url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=500&fit=crop',
    likes_count: 92,
    reposts_count: 14,
    replies_count: 1,
    created_at: new Date(Date.now() - 1000 * 60 * 95).toISOString()
  },
  {
    id: 'post-3',
    author_id: 'user-5',
    content: 'Pessoal de Cálculo I e II: hoje às 18h vai rolar plantão de monitoria na sala B-204 focando em integrais por substituição trigonométrica. Tragam suas listas! 📐📚 #MonitoriaCalculo #SemanaDeProvas',
    image_url: null,
    likes_count: 64,
    reposts_count: 23,
    replies_count: 1,
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString()
  },
  {
    id: 'post-4',
    author_id: 'user-4',
    content: 'A Biblioteca Central no pôr do sol fica simplesmente surreal. Faltam 3 semanas para entregar o projeto de iniciação científica, foco total! 📖🌅',
    image_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&h=500&fit=crop',
    likes_count: 115,
    reposts_count: 9,
    replies_count: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 320).toISOString()
  }
];

const INITIAL_REPLIES = [
  {
    id: 'rep-1',
    post_id: 'post-1',
    author_id: 'user-1',
    content: 'Acabei de sair de lá! Hoje é frango grelhado com purê de batata e salada tropical. A fila tá bem rápida!',
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString()
  },
  {
    id: 'rep-2',
    post_id: 'post-1',
    author_id: 'user-4',
    content: 'Obrigada pelo aviso, tô indo pra lá agora mesmo haha',
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString()
  },
  {
    id: 'rep-3',
    post_id: 'post-2',
    author_id: 'user-1',
    content: 'Ficou muito limpo, Rafa! A tipografia e o contraste no dark mode estão impecáveis.',
    created_at: new Date(Date.now() - 1000 * 60 * 70).toISOString()
  },
  {
    id: 'rep-4',
    post_id: 'post-3',
    author_id: 'user-3',
    content: 'Salvou demais! Vou colar lá depois da aula de projeto.',
    created_at: new Date(Date.now() - 1000 * 60 * 140).toISOString()
  }
];

const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    user_id: 'user-1',
    actor_id: 'user-2',
    type: 'like',
    post_id: 'post-1',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    id: 'notif-2',
    user_id: 'user-1',
    actor_id: 'user-3',
    type: 'repost',
    post_id: 'post-2',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  },
  {
    id: 'notif-3',
    user_id: 'user-1',
    actor_id: 'user-5',
    type: 'follow',
    post_id: null,
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString()
  },
  {
    id: 'notif-4',
    user_id: 'user-1',
    actor_id: 'user-4',
    type: 'reply',
    post_id: 'post-1',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString()
  }
];

const INITIAL_CONVERSATIONS = [
  {
    id: 'conv-1',
    participant_1: 'user-1',
    participant_2: 'user-2',
    updated_at: new Date(Date.now() - 1000 * 60 * 10).toISOString()
  },
  {
    id: 'conv-2',
    participant_1: 'user-1',
    participant_2: 'user-3',
    updated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  }
];

const INITIAL_MESSAGES = [
  {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-2',
    content: 'Oi Lucas! Você vai na integração das atléticas sexta-feira?',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString()
  },
  {
    id: 'msg-2',
    conversation_id: 'conv-1',
    sender_id: 'user-1',
    content: 'Com certeza! Só vou terminar de entregar o trabalho de Sistemas Operacionais até às 19h e já vou.',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString()
  },
  {
    id: 'msg-3',
    conversation_id: 'conv-1',
    sender_id: 'user-2',
    content: 'Perfeito! A galera da Med vai se encontrar perto do portão principal.',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString()
  },
  {
    id: 'msg-4',
    conversation_id: 'conv-2',
    sender_id: 'user-3',
    content: 'Te mandei o link do Figma com os ícones do Campus Conect!',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  }
];

const CAMPUS_GALLERY_PRESETS = [
  {
    label: 'Biblioteca Central',
    url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&h=500&fit=crop'
  },
  {
    label: 'Hackathon / Lab',
    url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=500&fit=crop'
  },
  {
    label: 'Campus ao Ar Livre',
    url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=800&h=500&fit=crop'
  },
  {
    label: 'Café & Estudos',
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&h=500&fit=crop'
  }
];

const TRENDING_TOPICS = [
  { tag: '#SemanaDeProvas', category: 'Acadêmico • Em alta', posts: '1.420 posts' },
  { tag: '#Intercomp2026', category: 'Esportes & Atléticas', posts: '985 posts' },
  { tag: '#MonitoriaCalculo', category: 'Exatas • Ajuda', posts: '612 posts' },
  { tag: '#RUHoje', category: 'Vida no Campus', posts: '2.190 posts' },
  { tag: '#IniciacaoCientifica', category: 'Pesquisa & CNPq', posts: '430 posts' }
];

// ============================================================================
// 3. HELPER FUNCTIONS (RELATIVE TIME, HASHTAG HIGHLIGHTER, PWA META INJECTOR)
// ============================================================================
function formatRelativeTime(isoString) {
  const diffSec = Math.max(1, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function renderFormattedText(text, onHashtagClick) {
  const parts = text.split(/(#[a-zA-Z0-9_À-ÿ]+|@[a-zA-Z0-9_]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('#')) {
      return (
        <span
          key={idx}
          onClick={(e) => {
            e.stopPropagation();
            if (onHashtagClick) onHashtagClick(part);
          }}
          className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer hover:underline"
        >
          {part}
        </span>
      );
    }
    if (part.startsWith('@')) {
      return (
        <span key={idx} className="text-indigo-400 font-medium">
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

// ============================================================================
// 4. BRAND LOGO SVG COMPONENT
// ============================================================================
const CampusLogo = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0"
  >
    <defs>
      <linearGradient id="campusGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="55%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="12" fill="url(#campusGrad)" />
    {/* Capelo / Graduation Cap + Connection Nodes */}
    <path
      d="M20 10L8 16L20 22L32 16L20 10Z"
      fill="white"
      fillOpacity="0.95"
    />
    <path
      d="M12 19.5V25.5C12 27.5 15.5 29.5 20 29.5C24.5 29.5 28 27.5 28 25.5V19.5L20 23.5L12 19.5Z"
      fill="white"
      fillOpacity="0.82"
    />
    <circle cx="31" cy="24" r="2.2" fill="#06B6D4" stroke="white" strokeWidth="1.2" />
    <path d="M31 16V22" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// ============================================================================
// 5. MAIN APPLICATION COMPONENT
// ============================================================================
export default function App() {
  // --- Theme State (Dark default: #090D16 & #111827) ---
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('cc_theme');
    return saved ? saved === 'dark' : true;
  });

  // --- Auth & Supabase Connection State ---
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('cc_current_user') || null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNome, setAuthNome] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authCurso, setAuthCurso] = useState('Eng. Software');
  const [authFaculdade, setAuthFaculdade] = useState('USP');
  const [authLoading, setAuthLoading] = useState(false);

  const [supabaseConfig, setSupabaseConfig] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_supabase_cfg')) || { url: '', anonKey: '', connected: false };
    } catch {
      return { url: '', anonKey: '', connected: false };
    }
  });

  // --- Database Entities (Persisted in localStorage for full stateful UX) ---
  const [profiles, setProfiles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_profiles')) || INITIAL_PROFILES;
    } catch {
      return INITIAL_PROFILES;
    }
  });

  const [posts, setPosts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_posts')) || INITIAL_POSTS;
    } catch {
      return INITIAL_POSTS;
    }
  });

  const [likes, setLikes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_likes')) || [{ user_id: 'user-1', post_id: 'post-2' }];
    } catch {
      return [];
    }
  });

  const [reposts, setReposts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_reposts')) || [{ user_id: 'user-1', post_id: 'post-3' }];
    } catch {
      return [];
    }
  });

  const [bookmarks, setBookmarks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_bookmarks')) || [{ user_id: 'user-1', post_id: 'post-2' }];
    } catch {
      return [];
    }
  });

  const [follows, setFollows] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('cc_follows')) || [
          { follower_id: 'user-1', following_id: 'user-2' },
          { follower_id: 'user-1', following_id: 'user-3' }
        ]
      );
    } catch {
      return [];
    }
  });

  const [replies, setReplies] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_replies')) || INITIAL_REPLIES;
    } catch {
      return INITIAL_REPLIES;
    }
  });

  const [notifications, setNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_notifications')) || INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });

  const [conversations, setConversations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_conversations')) || INITIAL_CONVERSATIONS;
    } catch {
      return INITIAL_CONVERSATIONS;
    }
  });

  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cc_messages')) || INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });

  // --- Navigation & UI State ---
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'search' | 'notifications' | 'messages' | 'profile'
  const [feedSubTab, setFeedSubTab] = useState('for-you'); // 'for-you' | 'following'
  const [profileSubTab, setProfileSubTab] = useState('posts'); // 'posts' | 'reposts' | 'bookmarks'
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [viewedProfileId, setViewedProfileId] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);

  // --- Search State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all'); // 'all' | 'people' | 'posts' | 'courses'

  // --- Modals & Drawers ---
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [composeImage, setComposeImage] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({});

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [pwaTab, setPwaTab] = useState('ios'); // 'ios' | 'android'
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState(null);
  const [showPwaBanner, setShowPwaBanner] = useState(true);

  // --- Reply & Chat Inputs ---
  const [replyText, setReplyText] = useState('');
  const [chatText, setChatText] = useState('');

  // --- Loading Skeleton Simulation on Tab Switch ---
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  // --- Toast Notification System ---
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // --- Inject Dynamic PWA Manifest & Meta Tags into Document Head ---
  useEffect(() => {
    document.title = 'Campus Conect • Rede Social Universitária';
    const manifestObj = {
      name: 'Campus Conect',
      short_name: 'Campus',
      start_url: '/',
      display: 'standalone',
      background_color: '#090D16',
      theme_color: '#6366F1',
      description: 'Rede social universitária feita para conectar estudantes, cursos e atléticas.',
      icons: [
        {
          src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="48" fill="%236366F1"/><path d="M96 48L38 77L96 106L154 77L96 48Z" fill="white"/></svg>',
          sizes: '192x192',
          type: 'image/svg+xml'
        },
        {
          src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="128" fill="%236366F1"/><path d="M256 128L102 205L256 282L410 205L256 128Z" fill="white"/></svg>',
          sizes: '512x512',
          type: 'image/svg+xml'
        }
      ]
    };

    const stringManifest = JSON.stringify(manifestObj);
    const blob = new Blob([stringManifest], { type: 'application/manifest+json' });
    const manifestURL = URL.createObjectURL(blob);

    let linkManifest = document.querySelector('link[rel="manifest"]');
    if (!linkManifest) {
      linkManifest = document.createElement('link');
      linkManifest.rel = 'manifest';
      document.head.appendChild(linkManifest);
    }
    linkManifest.href = manifestURL;

    // Apple & Mobile Web App Meta Tags
    const metaTags = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'Campus Conect' },
      { name: 'theme-color', content: darkMode ? '#090D16' : '#FFFFFF' }
    ];

    metaTags.forEach(({ name, content }) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = name;
        document.head.appendChild(tag);
      }
      tag.content = content;
    });

    return () => URL.revokeObjectURL(manifestURL);
  }, [darkMode]);

  // --- Sync State with localStorage ---
  useEffect(() => {
    localStorage.setItem('cc_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (currentUserId) localStorage.setItem('cc_current_user', currentUserId);
    else localStorage.removeItem('cc_current_user');
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem('cc_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('cc_posts', JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem('cc_likes', JSON.stringify(likes));
  }, [likes]);

  useEffect(() => {
    localStorage.setItem('cc_reposts', JSON.stringify(reposts));
  }, [reposts]);

  useEffect(() => {
    localStorage.setItem('cc_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('cc_follows', JSON.stringify(follows));
  }, [follows]);

  useEffect(() => {
    localStorage.setItem('cc_replies', JSON.stringify(replies));
  }, [replies]);

  useEffect(() => {
    localStorage.setItem('cc_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('cc_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('cc_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('cc_supabase_cfg', JSON.stringify(supabaseConfig));
  }, [supabaseConfig]);

  // --- Derived Data ---
  const currentUser = useMemo(
    () => profiles.find((p) => p.id === currentUserId) || null,
    [profiles, currentUserId]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => n.user_id === currentUserId && !n.read).length,
    [notifications, currentUserId]
  );

  const unreadMessagesCount = useMemo(() => {
    if (!currentUserId) return 0;
    const myConvIds = conversations
      .filter((c) => c.participant_1 === currentUserId || c.participant_2 === currentUserId)
      .map((c) => c.id);
    return messages.filter((m) => myConvIds.includes(m.conversation_id) && m.sender_id !== currentUserId && !m.read)
      .length;
  }, [conversations, messages, currentUserId]);

  // --- Theme Tokens ---
  const theme = darkMode
    ? {
        bgOuter: 'bg-[#05070D]',
        bgMain: 'bg-[#090D16]',
        bgSurface: 'bg-[#111827]',
        bgSurfaceHover: 'hover:bg-[#161F33]',
        bgGlass: 'bg-[#090D16]/85 backdrop-blur-xl',
        border: 'border-slate-800/80',
        textPrimary: 'text-slate-100',
        textSecondary: 'text-slate-400',
        textMuted: 'text-slate-500',
        inputBg: 'bg-[#111827] border-slate-700/80 text-slate-100 placeholder-slate-500'
      }
    : {
        bgOuter: 'bg-slate-200/70',
        bgMain: 'bg-[#F8FAFC]',
        bgSurface: 'bg-white',
        bgSurfaceHover: 'hover:bg-slate-50',
        bgGlass: 'bg-white/85 backdrop-blur-xl',
        border: 'border-slate-200',
        textPrimary: 'text-slate-900',
        textSecondary: 'text-slate-600',
        textMuted: 'text-slate-400',
        inputBg: 'bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400'
      };

  // ============================================================================
  // 6. ACTIONS & EVENT HANDLERS
  // ============================================================================
  const handleInstantDemoLogin = (userId = 'user-1') => {
    setAuthLoading(true);
    setTimeout(() => {
      setCurrentUserId(userId);
      setAuthLoading(false);
      setActiveTab('home');
      showToast('Bem-vindo ao Campus Conect! 🎓');
    }, 450);
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      showToast('Preencha e-mail e senha para continuar.', 'error');
      return;
    }
    setAuthLoading(true);
    setTimeout(() => {
      if (authMode === 'register') {
        const cleanUsername = (authUsername || authEmail.split('@')[0])
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '');
        const newId = `user-${Date.now()}`;
        const newProfile = {
          id: newId,
          username: cleanUsername || `estudante_${Math.floor(Math.random() * 999)}`,
          nome: authNome.trim() || 'Estudante Universitário',
          bio: `Estudante de ${authCurso} na ${authFaculdade} 🎓✨`,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
          banner_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=300&fit=crop',
          curso: authCurso || 'Graduação',
          faculdade: authFaculdade || 'Universidade',
          ano_entrada: 2026,
          seguidores_count: 1,
          seguindo_count: 2,
          criado_em: new Date().toISOString()
        };
        setProfiles((prev) => [newProfile, ...prev]);
        setFollows((prev) => [
          ...prev,
          { follower_id: newId, following_id: 'user-1' },
          { follower_id: newId, following_id: 'user-2' }
        ]);
        setCurrentUserId(newId);
        showToast('Conta universitária criada com sucesso!');
      } else {
        setCurrentUserId('user-1');
        showToast('Login realizado com sucesso!');
      }
      setAuthLoading(false);
    }, 600);
  };

  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!composeText.trim() || composeText.length > 280) return;

    const newPost = {
      id: `post-${Date.now()}`,
      author_id: currentUserId,
      content: composeText.trim(),
      image_url: composeImage.trim() || null,
      likes_count: 0,
      reposts_count: 0,
      replies_count: 0,
      created_at: new Date().toISOString()
    };

    setPosts((prev) => [newPost, ...prev]);
    setComposeText('');
    setComposeImage('');
    setShowImagePicker(false);
    setIsComposeOpen(false);
    showToast('Post publicado no feed do campus! 🚀');
  };

  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setComposeImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleLike = (postId, postAuthorId) => {
    const alreadyLiked = likes.some((l) => l.user_id === currentUserId && l.post_id === postId);
    if (alreadyLiked) {
      setLikes((prev) => prev.filter((l) => !(l.user_id === currentUserId && l.post_id === postId)));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p))
      );
    } else {
      setLikes((prev) => [...prev, { user_id: currentUserId, post_id: postId }]);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p)));
      if (postAuthorId !== currentUserId) {
        setNotifications((prev) => [
          {
            id: `notif-${Date.now()}`,
            user_id: postAuthorId,
            actor_id: currentUserId,
            type: 'like',
            post_id: postId,
            read: false,
            created_at: new Date().toISOString()
          },
          ...prev
        ]);
      }
    }
  };

  const toggleRepost = (postId, postAuthorId) => {
    const alreadyReposted = reposts.some((r) => r.user_id === currentUserId && r.post_id === postId);
    if (alreadyReposted) {
      setReposts((prev) => prev.filter((r) => !(r.user_id === currentUserId && r.post_id === postId)));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, reposts_count: Math.max(0, p.reposts_count - 1) } : p))
      );
      showToast('Repost removido', 'info');
    } else {
      setReposts((prev) => [...prev, { user_id: currentUserId, post_id: postId }]);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, reposts_count: p.reposts_count + 1 } : p)));
      showToast('Repostado no seu perfil! 🔁');
      if (postAuthorId !== currentUserId) {
        setNotifications((prev) => [
          {
            id: `notif-${Date.now()}`,
            user_id: postAuthorId,
            actor_id: currentUserId,
            type: 'repost',
            post_id: postId,
            read: false,
            created_at: new Date().toISOString()
          },
          ...prev
        ]);
      }
    }
  };

  const toggleBookmark = (postId) => {
    const alreadySaved = bookmarks.some((b) => b.user_id === currentUserId && b.post_id === postId);
    if (alreadySaved) {
      setBookmarks((prev) => prev.filter((b) => !(b.user_id === currentUserId && b.post_id === postId)));
      showToast('Removido dos itens salvos', 'info');
    } else {
      setBookmarks((prev) => [...prev, { user_id: currentUserId, post_id: postId }]);
      showToast('Post salvo nos seus favoritos! 🔖');
    }
  };

  const handleSharePost = (post) => {
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    showToast('Link do post copiado para compartilhar! 🔗');
  };

  const handleDeletePost = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setConfirmDeletePostId(null);
    if (selectedPostId === postId) setSelectedPostId(null);
    showToast('Post excluído com sucesso.', 'info');
  };

  const toggleFollow = (targetUserId) => {
    if (targetUserId === currentUserId) return;
    const isFollowing = follows.some((f) => f.follower_id === currentUserId && f.following_id === targetUserId);
    if (isFollowing) {
      setFollows((prev) => prev.filter((f) => !(f.follower_id === currentUserId && f.following_id === targetUserId)));
      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id === targetUserId) return { ...p, seguidores_count: Math.max(0, p.seguidores_count - 1) };
          if (p.id === currentUserId) return { ...p, seguindo_count: Math.max(0, p.seguindo_count - 1) };
          return p;
        })
      );
      showToast('Você deixou de seguir este estudante', 'info');
    } else {
      setFollows((prev) => [...prev, { follower_id: currentUserId, following_id: targetUserId }]);
      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id === targetUserId) return { ...p, seguidores_count: p.seguidores_count + 1 };
          if (p.id === currentUserId) return { ...p, seguindo_count: p.seguindo_count + 1 };
          return p;
        })
      );
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          user_id: targetUserId,
          actor_id: currentUserId,
          type: 'follow',
          post_id: null,
          read: false,
          created_at: new Date().toISOString()
        },
        ...prev
      ]);
      showToast('Seguindo! ✨');
    }
  };

  const handleAddReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedPostId) return;
    const targetPost = posts.find((p) => p.id === selectedPostId);
    if (!targetPost) return;

    const newReply = {
      id: `rep-${Date.now()}`,
      post_id: selectedPostId,
      author_id: currentUserId,
      content: replyText.trim(),
      created_at: new Date().toISOString()
    };

    setReplies((prev) => [...prev, newReply]);
    setPosts((prev) =>
      prev.map((p) => (p.id === selectedPostId ? { ...p, replies_count: p.replies_count + 1 } : p))
    );
    setReplyText('');
    showToast('Resposta enviada! 💬');

    if (targetPost.author_id !== currentUserId) {
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          user_id: targetPost.author_id,
          actor_id: currentUserId,
          type: 'reply',
          post_id: selectedPostId,
          read: false,
          created_at: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  const openOrStartConversation = (otherUserId) => {
    if (otherUserId === currentUserId) return;
    const existing = conversations.find(
      (c) =>
        (c.participant_1 === currentUserId && c.participant_2 === otherUserId) ||
        (c.participant_1 === otherUserId && c.participant_2 === currentUserId)
    );
    if (existing) {
      setActiveConversationId(existing.id);
      markConversationRead(existing.id);
    } else {
      const newConv = {
        id: `conv-${Date.now()}`,
        participant_1: currentUserId,
        participant_2: otherUserId,
        updated_at: new Date().toISOString()
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
    }
    setViewedProfileId(null);
    setSelectedPostId(null);
    setActiveTab('messages');
  };

  const markConversationRead = (convId) => {
    setMessages((prev) =>
      prev.map((m) => (m.conversation_id === convId && m.sender_id !== currentUserId ? { ...m, read: true } : m))
    );
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatText.trim() || !activeConversationId) return;
    const msgContent = chatText.trim();
    const newMsg = {
      id: `msg-${Date.now()}`,
      conversation_id: activeConversationId,
      sender_id: currentUserId,
      content: msgContent,
      read: false,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, newMsg]);
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversationId ? { ...c, updated_at: new Date().toISOString() } : c))
    );
    setChatText('');

    // Simulate friendly academic auto-reply in Demo Mode
    const conv = conversations.find((c) => c.id === activeConversationId);
    const otherId = conv?.participant_1 === currentUserId ? conv?.participant_2 : conv?.participant_1;
    if (otherId) {
      setTimeout(() => {
        const autoReplies = [
          'Boa! Me avisa quando estiver chegando no campus 👍',
          'Fechado! Vou levar o notebook pra gente adiantar aquela parte.',
          'Show demais! Nos vemos depois da aula 😄',
          'Combinado! Qualquer coisa me chama aqui no Campus Conect.'
        ];
        const replyMsg = {
          id: `msg-${Date.now() + 1}`,
          conversation_id: activeConversationId,
          sender_id: otherId,
          content: autoReplies[Math.floor(Math.random() * autoReplies.length)],
          read: true,
          created_at: new Date().toISOString()
        };
        setMessages((prev) => [...prev, replyMsg]);
      }, 1200);
    }
  };

  const handleOpenEditProfile = () => {
    if (!currentUser) return;
    setEditProfileForm({
      nome: currentUser.nome,
      bio: currentUser.bio,
      curso: currentUser.curso,
      faculdade: currentUser.faculdade,
      ano_entrada: currentUser.ano_entrada,
      avatar_url: currentUser.avatar_url,
      banner_url: currentUser.banner_url
    });
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === currentUserId
          ? {
              ...p,
              ...editProfileForm,
              ano_entrada: Number(editProfileForm.ano_entrada) || 2024
            }
          : p
      )
    );
    setIsEditProfileOpen(false);
    showToast('Perfil atualizado com sucesso! ✨');
  };

  const switchMainTab = (tab) => {
    setSelectedPostId(null);
    setViewedProfileId(null);
    setActiveConversationId(null);
    if (tab !== activeTab) {
      setIsLoadingFeed(true);
      setActiveTab(tab);
      setTimeout(() => setIsLoadingFeed(false), 260);
    }
  };

  // ============================================================================
  // 7. REUSABLE POST CARD COMPONENT
  // ============================================================================
  const PostCard = ({ post, isDetail = false }) => {
    const author = profiles.find((p) => p.id === post.author_id) || profiles[0];
    const isLiked = likes.some((l) => l.user_id === currentUserId && l.post_id === post.id);
    const isReposted = reposts.some((r) => r.user_id === currentUserId && r.post_id === post.id);
    const isSaved = bookmarks.some((b) => b.user_id === currentUserId && b.post_id === post.id);
    const isOwnPost = post.author_id === currentUserId;

    return (
      <article
        onClick={() => {
          if (!isDetail) setSelectedPostId(post.id);
        }}
        className={`p-4 border-b ${theme.border} transition-colors ${
          !isDetail ? `cursor-pointer ${theme.bgSurfaceHover}` : ''
        }`}
      >
        <div className="flex gap-3">
          {/* Avatar */}
          <img
            src={author.avatar_url}
            alt={author.nome}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPostId(null);
              setViewedProfileId(author.id);
            }}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-indigo-500/30 shrink-0 cursor-pointer hover:opacity-90 transition"
          />

          {/* Content Column */}
          <div className="flex-1 min-w-0">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPostId(null);
                  setViewedProfileId(author.id);
                }}
                className="min-w-0 cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`font-bold text-[15px] truncate group-hover:underline ${theme.textPrimary}`}>
                    {author.nome}
                  </span>
                  <span className={`text-xs truncate ${theme.textSecondary}`}>@{author.username}</span>
                  <span className={`text-xs ${theme.textMuted}`}>• {formatRelativeTime(post.created_at)}</span>
                </div>
                {/* University & Course Pill */}
                <div className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                  <GraduationCap className="w-3 h-3" />
                  <span>
                    {author.curso} • {author.faculdade}
                  </span>
                </div>
              </div>

              {isOwnPost && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeletePostId(post.id);
                  }}
                  title="Excluir post"
                  className={`p-1.5 rounded-full ${theme.textMuted} hover:text-rose-400 hover:bg-rose-500/10 transition`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Post Body */}
            <p className={`mt-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${theme.textPrimary}`}>
              {renderFormattedText(post.content, (tag) => {
                setSelectedPostId(null);
                setViewedProfileId(null);
                setSearchQuery(tag);
                setActiveTab('search');
              })}
            </p>

            {/* Optional Image Attachment */}
            {post.image_url && (
              <div className="mt-3 rounded-2xl overflow-hidden border border-slate-700/40 bg-slate-900/40">
                <img
                  src={post.image_url}
                  alt="Anexo do post"
                  className="w-full max-h-72 object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Action Bar */}
            <div className={`mt-3.5 flex items-center justify-between max-w-md ${theme.textSecondary}`}>
              {/* Reply */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPostId(post.id);
                }}
                className="flex items-center gap-1.5 text-xs group hover:text-cyan-400 transition active:scale-95 py-1 pr-2"
              >
                <div className="p-1.5 rounded-full group-hover:bg-cyan-500/15 transition">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span>{post.replies_count}</span>
              </button>

              {/* Repost */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRepost(post.id, post.author_id);
                }}
                className={`flex items-center gap-1.5 text-xs group transition active:scale-95 py-1 px-2 ${
                  isReposted ? 'text-emerald-400 font-semibold' : 'hover:text-emerald-400'
                }`}
              >
                <div className="p-1.5 rounded-full group-hover:bg-emerald-500/15 transition">
                  <Repeat2 className={`w-4 h-4 transition-transform duration-300 ${isReposted ? 'rotate-180' : ''}`} />
                </div>
                <span>{post.reposts_count}</span>
              </button>

              {/* Like */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLike(post.id, post.author_id);
                }}
                className={`flex items-center gap-1.5 text-xs group transition active:scale-90 py-1 px-2 ${
                  isLiked ? 'text-rose-500 font-semibold' : 'hover:text-rose-500'
                }`}
              >
                <div className="p-1.5 rounded-full group-hover:bg-rose-500/15 transition">
                  <Heart
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isLiked ? 'fill-rose-500 scale-110' : ''
                    }`}
                  />
                </div>
                <span>{post.likes_count}</span>
              </button>

              {/* Bookmark */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(post.id);
                }}
                className={`flex items-center gap-1 text-xs group transition active:scale-95 py-1 px-2 ${
                  isSaved ? 'text-indigo-400' : 'hover:text-indigo-400'
                }`}
              >
                <div className="p-1.5 rounded-full group-hover:bg-indigo-500/15 transition">
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-indigo-400' : ''}`} />
                </div>
              </button>

              {/* Share */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSharePost(post);
                }}
                className="flex items-center gap-1 text-xs group hover:text-purple-400 transition active:scale-95 py-1 pl-2"
              >
                <div className="p-1.5 rounded-full group-hover:bg-purple-500/15 transition">
                  <Share2 className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  // ============================================================================
  // 8. AUTHENTICATION & ONBOARDING SCREEN (WHEN LOGGED OUT)
  // ============================================================================
  if (!currentUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme.bgOuter} transition-colors`}>
        <div
          className={`w-full max-w-md rounded-3xl border ${theme.border} ${theme.bgMain} shadow-2xl overflow-hidden p-6 sm:p-8`}
        >
          {/* Header Brand */}
          <div className="flex flex-col items-center text-center">
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4 shadow-lg shadow-indigo-500/10">
              <CampusLogo size={44} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Campus Conect
            </h1>
            <p className={`text-sm mt-1.5 ${theme.textSecondary}`}>
              A rede social exclusiva da sua universidade. Conecte-se com colegas, cursos e atléticas.
            </p>
          </div>

          {/* Instant Demo Mode CTA */}
          <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-cyan-600/20 border border-indigo-500/30">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Acesso Rápido</span>
            </div>
            <p className={`text-xs mb-3 ${theme.textSecondary}`}>
              Explore o app completo agora mesmo com feed universitário ativo, DMs e notificações simuladas.
            </p>
            <button
              onClick={() => handleInstantDemoLogin('user-1')}
              disabled={authLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:opacity-95 active:scale-[0.99] transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <GraduationCap className="w-4 h-4" />
                  <span>Entrar no Modo Demonstração Instantâneo</span>
                </>
              )}
            </button>
          </div>

          <div className="relative my-6 flex items-center justify-center">
            <div className={`border-t w-full ${theme.border}`} />
            <span className={`px-3 text-xs uppercase tracking-wider ${theme.bgMain} ${theme.textMuted}`}>
              ou use sua conta
            </span>
          </div>

          {/* Auth Tabs */}
          <div className={`grid grid-cols-2 p-1 rounded-xl mb-4 ${darkMode ? 'bg-slate-900' : 'bg-slate-200'}`}>
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`py-2 text-xs font-bold rounded-lg transition ${
                authMode === 'login'
                  ? 'bg-indigo-600 text-white shadow'
                  : `${theme.textSecondary} hover:text-indigo-400`
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`py-2 text-xs font-bold rounded-lg transition ${
                authMode === 'register'
                  ? 'bg-indigo-600 text-white shadow'
                  : `${theme.textSecondary} hover:text-indigo-400`
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            {authMode === 'register' && (
              <>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={authNome}
                  onChange={(e) => setAuthNome(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme.inputBg}`}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Curso (ex: Direito)"
                    value={authCurso}
                    onChange={(e) => setAuthCurso(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme.inputBg}`}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Faculdade (ex: USP)"
                    value={authFaculdade}
                    onChange={(e) => setAuthFaculdade(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme.inputBg}`}
                    required
                  />
                </div>
              </>
            )}

            <input
              type="email"
              placeholder="E-mail institucional ou pessoal"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme.inputBg}`}
              required
            />
            <input
              type="password"
              placeholder="Senha"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme.inputBg}`}
              required
            />

            <button
              type="submit"
              disabled={authLoading}
              className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm border ${theme.border} ${theme.bgSurface} ${theme.textPrimary} hover:border-indigo-500 transition`}
            >
              {authMode === 'login' ? 'Entrar com E-mail' : 'Cadastrar Estudante'}
            </button>
          </form>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={() => handleInstantDemoLogin('user-1')}
            className={`mt-3 w-full py-2.5 px-4 rounded-xl font-semibold text-sm border ${theme.border} ${theme.bgSurface} ${theme.textPrimary} hover:bg-indigo-500/10 transition flex items-center justify-center gap-2`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>Continuar com Google</span>
          </button>

          {/* Footer PWA & Theme */}
          <div className="mt-6 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setIsPwaModalOpen(true)}
              className="text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Instalar App no Celular</span>
            </button>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg border ${theme.border} ${theme.textSecondary}`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 9. FILTERED DATA FOR ACTIVE VIEWS
  // ============================================================================
  const followingIds = follows.filter((f) => f.follower_id === currentUserId).map((f) => f.following_id);

  const visibleFeedPosts = useMemo(() => {
    if (feedSubTab === 'following') {
      return posts.filter((p) => followingIds.includes(p.author_id) || p.author_id === currentUserId);
    }
    return posts;
  }, [posts, feedSubTab, followingIds, currentUserId]);

  const searchedProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.curso.toLowerCase().includes(q) ||
        p.faculdade.toLowerCase().includes(q)
    );
  }, [profiles, searchQuery]);

  const searchedPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) => {
      const author = profiles.find((p) => p.id === post.author_id);
      return (
        post.content.toLowerCase().includes(q) ||
        author?.curso.toLowerCase().includes(q) ||
        author?.faculdade.toLowerCase().includes(q)
      );
    });
  }, [posts, profiles, searchQuery]);

  const targetProfile = profiles.find((p) => p.id === (viewedProfileId || currentUserId)) || currentUser;

  const profileTabPosts = useMemo(() => {
    if (profileSubTab === 'posts') {
      return posts.filter((p) => p.author_id === targetProfile.id);
    }
    if (profileSubTab === 'reposts') {
      const repIds = reposts.filter((r) => r.user_id === targetProfile.id).map((r) => r.post_id);
      return posts.filter((p) => repIds.includes(p.id));
    }
    const bookIds = bookmarks.filter((b) => b.user_id === targetProfile.id).map((b) => b.post_id);
    return posts.filter((p) => bookIds.includes(p.id));
  }, [posts, reposts, bookmarks, profileSubTab, targetProfile.id]);

  // ============================================================================
  // 10. MAIN MOBILE-FIRST SHELL RENDER
  // ============================================================================
  return (
    <div className={`min-h-screen flex justify-center ${theme.bgOuter} transition-colors duration-200`}>
      {/* Mobile Native-like Container */}
      <div
        className={`w-full max-w-[480px] min-h-screen flex flex-col relative border-x ${theme.border} ${theme.bgMain} shadow-2xl`}
      >
        {/* ================= TOP STICKY HEADER ================= */}
        <header className={`sticky top-0 z-30 border-b ${theme.border} ${theme.bgGlass}`}>
          <div className="px-4 h-14 flex items-center justify-between">
            {/* Left: User Avatar / Drawer Trigger or Back Button */}
            {selectedPostId || viewedProfileId || activeConversationId ? (
              <button
                onClick={() => {
                  if (selectedPostId) setSelectedPostId(null);
                  else if (viewedProfileId) setViewedProfileId(null);
                  else if (activeConversationId) setActiveConversationId(null);
                }}
                className={`p-2 -ml-2 rounded-full ${theme.textPrimary} hover:bg-indigo-500/15 transition`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="relative group focus:outline-none"
                title="Menu e Configurações"
              >
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.nome}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/50 group-hover:ring-cyan-400 transition"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                    darkMode ? 'border-[#090D16]' : 'border-white'
                  } ${supabaseConfig.connected ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                />
              </button>
            )}

            {/* Center Brand or View Title */}
            <div className="flex items-center gap-2">
              {selectedPostId ? (
                <span className={`font-bold text-base ${theme.textPrimary}`}>Post</span>
              ) : viewedProfileId ? (
                <span className={`font-bold text-base ${theme.textPrimary}`}>{targetProfile.nome}</span>
              ) : activeConversationId ? (
                (() => {
                  const conv = conversations.find((c) => c.id === activeConversationId);
                  const otherId = conv?.participant_1 === currentUserId ? conv?.participant_2 : conv?.participant_1;
                  const otherUser = profiles.find((p) => p.id === otherId);
                  return (
                    <div className="flex items-center gap-2">
                      {otherUser && (
                        <img src={otherUser.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                      )}
                      <span className={`font-bold text-sm ${theme.textPrimary}`}>{otherUser?.nome || 'Chat'}</span>
                    </div>
                  );
                })()
              ) : (
                <div
                  onClick={() => switchMainTab('home')}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <CampusLogo size={26} />
                  <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                    Campus Conect
                  </span>
                </div>
              )}
            </div>

            {/* Right Quick Actions: PWA Install & Theme */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsPwaModalOpen(true)}
                title="Instalar App (PWA)"
                className="p-2 rounded-full text-cyan-400 hover:bg-cyan-500/15 transition"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                title="Alternar Tema"
                className={`p-2 rounded-full ${theme.textSecondary} hover:bg-indigo-500/15 transition`}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Sub-tabs for Home Feed */}
          {activeTab === 'home' && !selectedPostId && !viewedProfileId && (
            <div className="grid grid-cols-2 text-sm font-semibold">
              <button
                onClick={() => setFeedSubTab('for-you')}
                className={`py-3 relative transition ${
                  feedSubTab === 'for-you' ? theme.textPrimary : theme.textSecondary
                }`}
              >
                Para você
                {feedSubTab === 'for-you' && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" />
                )}
              </button>
              <button
                onClick={() => setFeedSubTab('following')}
                className={`py-3 relative transition ${
                  feedSubTab === 'following' ? theme.textPrimary : theme.textSecondary
                }`}
              >
                Seguindo
                {feedSubTab === 'following' && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" />
                )}
              </button>
            </div>
          )}
        </header>

        {/* ================= PWA INSTALL PROMPT BANNER ================= */}
        {showPwaBanner && activeTab === 'home' && !selectedPostId && !viewedProfileId && (
          <div className="mx-3 mt-3 p-3 rounded-2xl bg-gradient-to-r from-indigo-600/20 via-purple-600/15 to-cyan-600/20 border border-indigo-500/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold truncate ${theme.textPrimary}`}>Use como App no Celular</p>
                <p className={`text-[11px] truncate ${theme.textSecondary}`}>
                  Instale na tela inicial sem barra de navegador
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsPwaModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition"
              >
                Instalar
              </button>
              <button
                onClick={() => setShowPwaBanner(false)}
                className={`p-1 rounded-lg ${theme.textMuted} hover:text-slate-300`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= MAIN CONTENT AREA ================= */}
        <main className="flex-1 pb-24">
          {/* Skeleton Loading State */}
          {isLoadingFeed ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className={`p-4 rounded-2xl border ${theme.border} ${theme.bgSurface} animate-pulse`}>
                  <div className="flex gap-3">
                    <div className="w-11 h-11 rounded-full bg-slate-700/40" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-3.5 bg-slate-700/40 rounded w-1/2" />
                      <div className="h-3 bg-slate-700/30 rounded w-1/3" />
                      <div className="h-14 bg-slate-700/30 rounded w-full mt-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : selectedPostId ? (
            /* ---------------- SINGLE POST & THREAD DETAIL VIEW ---------------- */
            (() => {
              const post = posts.find((p) => p.id === selectedPostId);
              if (!post) return null;
              const postReplies = replies.filter((r) => r.post_id === post.id);

              return (
                <div>
                  <PostCard post={post} isDetail />

                  {/* Reply Composer */}
                  <form onSubmit={handleAddReply} className={`p-4 border-b ${theme.border} flex gap-3 items-center`}>
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.nome}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                    <input
                      type="text"
                      placeholder="Postar sua resposta..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      maxLength={280}
                      className={`flex-1 px-3.5 py-2 rounded-full border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme.inputBg}`}
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="p-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white disabled:opacity-40 transition active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>

                  {/* Replies List */}
                  {postReplies.length === 0 ? (
                    <div className="py-12 px-6 text-center">
                      <MessageCircle className={`w-10 h-10 mx-auto mb-2 ${theme.textMuted}`} />
                      <p className={`text-sm font-medium ${theme.textSecondary}`}>Nenhuma resposta ainda</p>
                      <p className={`text-xs mt-1 ${theme.textMuted}`}>Seja o primeiro estudante a comentar!</p>
                    </div>
                  ) : (
                    <div>
                      {postReplies.map((rep) => {
                        const repAuthor = profiles.find((p) => p.id === rep.author_id) || profiles[0];
                        return (
                          <div key={rep.id} className={`p-4 border-b ${theme.border} flex gap-3`}>
                            <img
                              src={repAuthor.avatar_url}
                              alt={repAuthor.nome}
                              onClick={() => {
                                setSelectedPostId(null);
                                setViewedProfileId(repAuthor.id);
                              }}
                              className="w-9 h-9 rounded-full object-cover cursor-pointer shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-bold text-sm ${theme.textPrimary}`}>{repAuthor.nome}</span>
                                <span className={`text-xs ${theme.textSecondary}`}>@{repAuthor.username}</span>
                                <span className={`text-xs ${theme.textMuted}`}>
                                  • {formatRelativeTime(rep.created_at)}
                                </span>
                              </div>
                              <p className={`text-xs text-indigo-400 mt-0.5`}>
                                {repAuthor.curso} • {repAuthor.faculdade}
                              </p>
                              <p className={`mt-1.5 text-sm leading-relaxed ${theme.textPrimary}`}>{rep.content}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          ) : viewedProfileId || activeTab === 'profile' ? (
            /* ---------------- PROFILE VIEW (OWN OR OTHER STUDENT) ---------------- */
            <div>
              {/* Banner */}
              <div className="relative h-32 bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500">
                {targetProfile.banner_url && (
                  <img
                    src={targetProfile.banner_url}
                    alt="Capa"
                    className="w-full h-full object-cover opacity-90"
                  />
                )}
              </div>

              {/* Avatar & Action Buttons */}
              <div className="px-4 pb-4">
                <div className="flex items-end justify-between -mt-11 mb-3">
                  <img
                    src={targetProfile.avatar_url}
                    alt={targetProfile.nome}
                    className={`w-20 h-20 rounded-full object-cover border-4 ${
                      darkMode ? 'border-[#090D16]' : 'border-[#F8FAFC]'
                    } shadow-lg`}
                  />

                  {targetProfile.id === currentUserId ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleOpenEditProfile}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold border ${theme.border} ${theme.bgSurface} ${theme.textPrimary} hover:border-indigo-500 transition flex items-center gap-1.5`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar Perfil</span>
                      </button>
                      <button
                        onClick={() => setIsDrawerOpen(true)}
                        className={`p-2 rounded-full border ${theme.border} ${theme.bgSurface} ${theme.textSecondary}`}
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openOrStartConversation(targetProfile.id)}
                        className={`p-2 rounded-full border ${theme.border} ${theme.bgSurface} ${theme.textPrimary} hover:border-cyan-400 transition`}
                        title="Enviar Mensagem Direta"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      {(() => {
                        const isFollowing = follows.some(
                          (f) => f.follower_id === currentUserId && f.following_id === targetProfile.id
                        );
                        return (
                          <button
                            onClick={() => toggleFollow(targetProfile.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                              isFollowing
                                ? `border ${theme.border} ${theme.bgSurface} ${theme.textPrimary}`
                                : 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md shadow-indigo-500/20'
                            }`}
                          >
                            {isFollowing ? 'Seguindo' : 'Seguir'}
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* User Details */}
                <h2 className={`text-lg font-extrabold ${theme.textPrimary}`}>{targetProfile.nome}</h2>
                <p className={`text-xs ${theme.textSecondary}`}>@{targetProfile.username}</p>

                {targetProfile.bio && (
                  <p className={`mt-2.5 text-sm leading-relaxed ${theme.textPrimary}`}>{targetProfile.bio}</p>
                )}

                {/* Academic Badges */}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {targetProfile.curso}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400 font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    {targetProfile.faculdade}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    Ingresso {targetProfile.ano_entrada}
                  </span>
                </div>

                {/* Followers / Following Counts */}
                <div className="mt-3.5 flex items-center gap-5 text-xs">
                  <div>
                    <span className={`font-bold ${theme.textPrimary}`}>{targetProfile.seguindo_count}</span>{' '}
                    <span className={theme.textSecondary}>Seguindo</span>
                  </div>
                  <div>
                    <span className={`font-bold ${theme.textPrimary}`}>{targetProfile.seguidores_count}</span>{' '}
                    <span className={theme.textSecondary}>Seguidores</span>
                  </div>
                </div>
              </div>

              {/* Profile Sub-Tabs */}
              <div className={`grid grid-cols-3 border-y ${theme.border} text-xs font-bold`}>
                {[
                  { id: 'posts', label: 'Posts' },
                  { id: 'reposts', label: 'Reposts' },
                  { id: 'bookmarks', label: 'Salvos' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setProfileSubTab(tab.id)}
                    className={`py-3 relative transition ${
                      profileSubTab === tab.id ? theme.textPrimary : theme.textSecondary
                    }`}
                  >
                    {tab.label}
                    {profileSubTab === tab.id && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-indigo-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Profile Posts List */}
              {profileTabPosts.length === 0 ? (
                <div className="py-14 px-6 text-center">
                  <Sparkles className={`w-10 h-10 mx-auto mb-2 ${theme.textMuted}`} />
                  <p className={`text-sm font-semibold ${theme.textSecondary}`}>Nada por aqui ainda</p>
                  <p className={`text-xs mt-1 ${theme.textMuted}`}>
                    {profileSubTab === 'posts'
                      ? 'Nenhum post publicado neste perfil.'
                      : profileSubTab === 'reposts'
                      ? 'Nenhum post repostado ainda.'
                      : 'Posts salvos com marcador aparecerão aqui.'}
                  </p>
                </div>
              ) : (
                profileTabPosts.map((post) => <PostCard key={post.id} post={post} />)
              )}
            </div>
          ) : activeTab === 'home' ? (
            /* ---------------- MAIN HOME FEED ---------------- */
            <div>
              {visibleFeedPosts.length === 0 ? (
                <div className="py-16 px-6 text-center">
                  <Users className={`w-12 h-12 mx-auto mb-3 ${theme.textMuted}`} />
                  <h3 className={`font-bold text-base ${theme.textPrimary}`}>Seu feed "Seguindo" está vazio</h3>
                  <p className={`text-xs mt-1 max-w-xs mx-auto ${theme.textSecondary}`}>
                    Siga colegas do seu curso ou explore a aba "Para você" para descobrir o que está rolando na
                    universidade.
                  </p>
                  <button
                    onClick={() => setFeedSubTab('for-you')}
                    className="mt-4 px-5 py-2 rounded-full text-xs font-bold bg-indigo-500 text-white"
                  >
                    Ver Para você
                  </button>
                </div>
              ) : (
                visibleFeedPosts.map((post) => <PostCard key={post.id} post={post} />)
              )}
            </div>
          ) : activeTab === 'search' ? (
            /* ---------------- SEARCH & EXPLORE VIEW ---------------- */
            <div>
              {/* Search Bar */}
              <div className={`p-3 border-b ${theme.border} sticky top-14 z-20 ${theme.bgGlass}`}>
                <div className="relative">
                  <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
                  <input
                    type="text"
                    placeholder="Buscar pessoas, cursos, faculdades ou #tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-10 pr-9 py-2.5 rounded-full border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme.inputBg}`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme.textMuted}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex gap-2 mt-2.5 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: 'Tudo' },
                    { id: 'people', label: 'Estudantes' },
                    { id: 'courses', label: 'Cursos & Faculdades' },
                    { id: 'posts', label: 'Posts' }
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => setSearchFilter(chip.id)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                        searchFilter === chip.id
                          ? 'bg-indigo-500 text-white'
                          : `${theme.bgSurface} border ${theme.border} ${theme.textSecondary}`
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trending on Campus when no query */}
              {!searchQuery && searchFilter === 'all' && (
                <div className={`p-4 border-b ${theme.border}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <h3 className={`font-extrabold text-sm ${theme.textPrimary}`}>Em alta nas Universidades</h3>
                  </div>
                  <div className="space-y-3">
                    {TRENDING_TOPICS.map((item) => (
                      <div
                        key={item.tag}
                        onClick={() => setSearchQuery(item.tag)}
                        className={`p-2.5 rounded-xl border ${theme.border} ${theme.bgSurface} cursor-pointer hover:border-indigo-500/50 transition flex items-center justify-between`}
                      >
                        <div>
                          <p className={`text-[11px] ${theme.textMuted}`}>{item.category}</p>
                          <p className="text-sm font-bold text-cyan-400">{item.tag}</p>
                        </div>
                        <span className={`text-xs ${theme.textSecondary}`}>{item.posts}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* People / Courses Results */}
              {(searchFilter === 'all' || searchFilter === 'people' || searchFilter === 'courses') && (
                <div className={`p-4 border-b ${theme.border}`}>
                  <h3 className={`font-extrabold text-sm mb-3 ${theme.textPrimary}`}>
                    Estudantes & Colegas ({searchedProfiles.length})
                  </h3>
                  {searchedProfiles.length === 0 ? (
                    <p className={`text-xs ${theme.textMuted}`}>Nenhum estudante encontrado para "{searchQuery}".</p>
                  ) : (
                    <div className="space-y-3">
                      {searchedProfiles.map((person) => {
                        const isFollowing = follows.some(
                          (f) => f.follower_id === currentUserId && f.following_id === person.id
                        );
                        return (
                          <div
                            key={person.id}
                            onClick={() => setViewedProfileId(person.id)}
                            className={`p-3 rounded-2xl border ${theme.border} ${theme.bgSurface} flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/40 transition`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={person.avatar_url}
                                alt={person.nome}
                                className="w-11 h-11 rounded-full object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <p className={`font-bold text-sm truncate ${theme.textPrimary}`}>{person.nome}</p>
                                <p className={`text-xs truncate ${theme.textSecondary}`}>@{person.username}</p>
                                <span className="inline-block mt-1 text-[11px] font-medium text-indigo-400">
                                  {person.curso} • {person.faculdade}
                                </span>
                              </div>
                            </div>
                            {person.id !== currentUserId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFollow(person.id);
                                }}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition ${
                                  isFollowing
                                    ? `border ${theme.border} ${theme.textPrimary}`
                                    : 'bg-indigo-500 text-white hover:bg-indigo-600'
                                }`}
                              >
                                {isFollowing ? 'Seguindo' : 'Seguir'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Posts Results */}
              {(searchFilter === 'all' || searchFilter === 'posts') && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <h3 className={`font-extrabold text-sm ${theme.textPrimary}`}>
                      Publicações ({searchedPosts.length})
                    </h3>
                  </div>
                  {searchedPosts.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className={`text-xs ${theme.textMuted}`}>Nenhum post corresponde à sua busca.</p>
                    </div>
                  ) : (
                    searchedPosts.map((post) => <PostCard key={post.id} post={post} />)
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'notifications' ? (
            /* ---------------- NOTIFICATIONS VIEW ---------------- */
            <div>
              <div className={`px-4 py-3 border-b ${theme.border} flex items-center justify-between`}>
                <h2 className={`font-extrabold text-base ${theme.textPrimary}`}>Notificações</h2>
                {unreadNotificationsCount > 0 && (
                  <button
                    onClick={() => {
                      setNotifications((prev) =>
                        prev.map((n) => (n.user_id === currentUserId ? { ...n, read: true } : n))
                      );
                      showToast('Todas marcadas como lidas');
                    }}
                    className="text-xs font-semibold text-indigo-400 hover:underline"
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>

              {(() => {
                const myNotifs = notifications.filter((n) => n.user_id === currentUserId);
                if (myNotifs.length === 0) {
                  return (
                    <div className="py-16 px-6 text-center">
                      <Bell className={`w-10 h-10 mx-auto mb-2 ${theme.textMuted}`} />
                      <p className={`text-sm font-semibold ${theme.textSecondary}`}>Sem notificações por enquanto</p>
                    </div>
                  );
                }

                return myNotifs.map((notif) => {
                  const actor = profiles.find((p) => p.id === notif.actor_id) || profiles[0];
                  const iconMap = {
                    like: <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />,
                    repost: <Repeat2 className="w-4 h-4 text-emerald-400" />,
                    reply: <MessageCircle className="w-4 h-4 text-cyan-400" />,
                    follow: <User className="w-4 h-4 text-indigo-400" />
                  };
                  const textMap = {
                    like: 'curtiu seu post',
                    repost: 'repostou sua publicação',
                    reply: 'respondeu ao seu post',
                    follow: 'começou a seguir você'
                  };

                  return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        setNotifications((prev) =>
                          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
                        );
                        if (notif.post_id) setSelectedPostId(notif.post_id);
                        else setViewedProfileId(actor.id);
                      }}
                      className={`p-4 border-b ${theme.border} flex items-start gap-3 cursor-pointer transition ${
                        !notif.read ? 'bg-indigo-500/10' : theme.bgSurfaceHover
                      }`}
                    >
                      <div className="mt-1">{iconMap[notif.type]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <img src={actor.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          {!notif.read && <span className="w-2 h-2 rounded-full bg-cyan-400" />}
                        </div>
                        <p className={`mt-1.5 text-sm ${theme.textPrimary}`}>
                          <span className="font-bold">{actor.nome}</span>{' '}
                          <span className={theme.textSecondary}>{textMap[notif.type]}</span>
                        </p>
                        <p className={`text-[11px] mt-0.5 ${theme.textMuted}`}>
                          {actor.curso} • {actor.faculdade} • {formatRelativeTime(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : activeTab === 'messages' ? (
            /* ---------------- DIRECT MESSAGES (LIST & CHAT ROOM) ---------------- */
            activeConversationId ? (
              <div className="flex flex-col h-[calc(100vh-7.5rem)]">
                {/* Chat Messages Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages
                    .filter((m) => m.conversation_id === activeConversationId)
                    .map((msg) => {
                      const isMine = msg.sender_id === currentUserId;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isMine
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-sm'
                                : `${theme.bgSurface} border ${theme.border} ${theme.textPrimary} rounded-bl-sm`
                            }`}
                          >
                            {msg.content}
                          </div>
                          <span className={`text-[10px] mt-1 px-1 ${theme.textMuted}`}>
                            {formatRelativeTime(msg.created_at)}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={handleSendMessage}
                  className={`p-3 border-t ${theme.border} ${theme.bgGlass} flex items-center gap-2`}
                >
                  <input
                    type="text"
                    placeholder="Escreva uma mensagem..."
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    className={`flex-1 px-4 py-2.5 rounded-full border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme.inputBg}`}
                  />
                  <button
                    type="submit"
                    disabled={!chatText.trim()}
                    className="p-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white disabled:opacity-40 transition active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            ) : (
              /* Conversations Inbox List */
              <div>
                <div className={`px-4 py-3 border-b ${theme.border}`}>
                  <h2 className={`font-extrabold text-base ${theme.textPrimary}`}>Mensagens Diretas</h2>
                  <p className={`text-xs ${theme.textSecondary}`}>Converse com colegas da sua universidade</p>
                </div>

                {/* Quick Start Chat Horizontal Strip */}
                <div className={`p-3 border-b ${theme.border}`}>
                  <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${theme.textMuted}`}>
                    Iniciar nova conversa
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {profiles
                      .filter((p) => p.id !== currentUserId)
                      .map((person) => (
                        <button
                          key={person.id}
                          onClick={() => openOrStartConversation(person.id)}
                          className="flex flex-col items-center gap-1 shrink-0 w-16 group"
                        >
                          <img
                            src={person.avatar_url}
                            alt={person.nome}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-500/30 group-hover:ring-cyan-400 transition"
                          />
                          <span className={`text-[11px] font-medium truncate w-full text-center ${theme.textPrimary}`}>
                            {person.nome.split(' ')[0]}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Existing Conversations */}
                {conversations
                  .filter((c) => c.participant_1 === currentUserId || c.participant_2 === currentUserId)
                  .map((conv) => {
                    const otherId = conv.participant_1 === currentUserId ? conv.participant_2 : conv.participant_1;
                    const otherUser = profiles.find((p) => p.id === otherId) || profiles[0];
                    const convMsgs = messages.filter((m) => m.conversation_id === conv.id);
                    const lastMsg = convMsgs[convMsgs.length - 1];
                    const hasUnread = convMsgs.some((m) => m.sender_id !== currentUserId && !m.read);

                    return (
                      <div
                        key={conv.id}
                        onClick={() => {
                          setActiveConversationId(conv.id);
                          markConversationRead(conv.id);
                        }}
                        className={`p-4 border-b ${theme.border} flex items-center gap-3 cursor-pointer ${theme.bgSurfaceHover} transition`}
                      >
                        <img
                          src={otherUser.avatar_url}
                          alt={otherUser.nome}
                          className="w-12 h-12 rounded-full object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`font-bold text-sm truncate ${theme.textPrimary}`}>{otherUser.nome}</span>
                            {lastMsg && (
                              <span className={`text-[11px] ${theme.textMuted}`}>
                                {formatRelativeTime(lastMsg.created_at)}
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] text-indigo-400`}>
                            {otherUser.curso} • {otherUser.faculdade}
                          </p>
                          <p
                            className={`text-xs truncate mt-0.5 ${
                              hasUnread ? `font-bold ${theme.textPrimary}` : theme.textSecondary
                            }`}
                          >
                            {lastMsg ? lastMsg.content : 'Toque para iniciar a conversa'}
                          </p>
                        </div>
                        {hasUnread && <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />}
                      </div>
                    );
                  })}
              </div>
            )
          ) : null}
        </main>

        {/* ================= FLOATING ACTION BUTTON (CREATE POST) ================= */}
        {!activeConversationId && (
          <button
            onClick={() => setIsComposeOpen(true)}
            aria-label="Criar novo post"
            className="fixed bottom-20 right-5 sm:right-[calc(50%-220px)] z-30 w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-500 text-white shadow-xl shadow-indigo-500/35 flex items-center justify-center hover:scale-105 active:scale-95 transition"
          >
            <Plus className="w-7 h-7" />
          </button>
        )}

        {/* ================= FIXED BOTTOM NAVIGATION BAR (5 TABS) ================= */}
        <nav
          className={`fixed bottom-0 w-full max-w-[480px] z-30 border-t ${theme.border} ${theme.bgGlass} px-2 h-16 flex items-center justify-around`}
        >
          {[
            { id: 'home', icon: Home, label: 'Início' },
            { id: 'search', icon: Search, label: 'Buscar' },
            { id: 'notifications', icon: Bell, label: 'Alertas', badge: unreadNotificationsCount },
            { id: 'messages', icon: Mail, label: 'Mensagens', badge: unreadMessagesCount },
            { id: 'profile', icon: User, label: 'Perfil' }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id && !selectedPostId && !viewedProfileId;
            return (
              <button
                key={item.id}
                onClick={() => switchMainTab(item.id)}
                className={`relative flex flex-col items-center justify-center w-16 h-full transition active:scale-90 ${
                  isActive ? 'text-indigo-400' : theme.textSecondary
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-[#090D16] text-[10px] font-extrabold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold mt-1">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ====================================================================
            MODALS & DRAWERS
            ==================================================================== */}

        {/* 1. COMPOSE POST MODAL */}
        {isComposeOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl border ${theme.border} ${theme.bgMain} p-5 shadow-2xl`}
            >
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setIsComposeOpen(false)}
                  className={`text-sm font-medium ${theme.textSecondary} hover:text-slate-200`}
                >
                  Cancelar
                </button>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-400">
                  {currentUser.curso} • {currentUser.faculdade}
                </span>
                <button
                  onClick={handleCreatePost}
                  disabled={!composeText.trim() || composeText.length > 280}
                  className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 disabled:opacity-40 transition active:scale-95"
                >
                  Publicar
                </button>
              </div>

              <div className="flex gap-3">
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.nome}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="flex-1">
                  <textarea
                    rows={4}
                    autoFocus
                    placeholder="O que está acontecendo no campus hoje? Use #hashtags..."
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    className={`w-full bg-transparent resize-none text-base focus:outline-none ${theme.textPrimary}`}
                  />

                  {composeImage && (
                    <div className="relative mt-2 rounded-2xl overflow-hidden border border-slate-700">
                      <img src={composeImage} alt="Preview" className="w-full max-h-48 object-cover" />
                      <button
                        type="button"
                        onClick={() => setComposeImage('')}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {showImagePicker && (
                    <div className={`mt-3 p-3 rounded-2xl border ${theme.border} ${theme.bgSurface} space-y-2.5`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${theme.textPrimary}`}>Adicionar imagem</span>
                        <label className="text-xs font-semibold text-cyan-400 cursor-pointer hover:underline">
                          Upload do dispositivo
                          <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                        </label>
                      </div>
                      <input
                        type="url"
                        placeholder="Ou cole a URL de uma imagem..."
                        value={composeImage}
                        onChange={(e) => setComposeImage(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded-lg border text-xs ${theme.inputBg}`}
                      />
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {CAMPUS_GALLERY_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setComposeImage(preset.url)}
                            className={`text-left text-[11px] px-2 py-1.5 rounded-lg border ${theme.border} hover:border-indigo-500 truncate ${theme.textSecondary}`}
                          >
                            📸 {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={`mt-4 pt-3 border-t ${theme.border} flex items-center justify-between`}>
                <button
                  type="button"
                  onClick={() => setShowImagePicker(!showImagePicker)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:bg-indigo-500/10 px-3 py-1.5 rounded-full transition"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Foto / Campus</span>
                </button>

                <span
                  className={`text-xs font-bold ${
                    composeText.length > 280
                      ? 'text-rose-500'
                      : composeText.length > 240
                      ? 'text-amber-400'
                      : theme.textMuted
                  }`}
                >
                  {280 - composeText.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 2. EDIT PROFILE MODAL */}
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className={`w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border ${theme.border} ${theme.bgMain} p-5 shadow-2xl`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-extrabold text-base ${theme.textPrimary}`}>Editar Perfil Universitário</h3>
                <button onClick={() => setIsEditProfileOpen(false)} className={theme.textSecondary}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3 text-sm">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${theme.textSecondary}`}>Nome</label>
                  <input
                    type="text"
                    value={editProfileForm.nome || ''}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, nome: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg}`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${theme.textSecondary}`}>Bio</label>
                  <textarea
                    rows={3}
                    value={editProfileForm.bio || ''}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, bio: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${theme.textSecondary}`}>Curso</label>
                    <input
                      type="text"
                      value={editProfileForm.curso || ''}
                      onChange={(e) => setEditProfileForm({ ...editProfileForm, curso: e.target.value })}
                      className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg}`}
                      required
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${theme.textSecondary}`}>Faculdade</label>
                    <input
                      type="text"
                      value={editProfileForm.faculdade || ''}
                      onChange={(e) => setEditProfileForm({ ...editProfileForm, faculdade: e.target.value })}
                      className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg}`}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${theme.textSecondary}`}>Ano de Entrada</label>
                    <input
                      type="number"
                      value={editProfileForm.ano_entrada || 2024}
                      onChange={(e) => setEditProfileForm({ ...editProfileForm, ano_entrada: e.target.value })}
                      className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${theme.textSecondary}`}>URL do Avatar</label>
                    <input
                      type="text"
                      value={editProfileForm.avatar_url || ''}
                      onChange={(e) => setEditProfileForm({ ...editProfileForm, avatar_url: e.target.value })}
                      className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg}`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${theme.textSecondary}`}>URL da Capa (Banner)</label>
                  <input
                    type="text"
                    value={editProfileForm.banner_url || ''}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, banner_url: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border ${theme.inputBg}`}
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border ${theme.border} ${theme.textSecondary}`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-cyan-500"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. SIDE SETTINGS DRAWER */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-start">
            <div className={`w-80 max-w-[85vw] h-full ${theme.bgMain} border-r ${theme.border} p-5 flex flex-col`}>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <CampusLogo size={28} />
                  <span className={`font-extrabold text-base ${theme.textPrimary}`}>Campus Conect</span>
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className={theme.textSecondary}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Account Summary */}
              <div className={`my-4 p-3 rounded-2xl border ${theme.border} ${theme.bgSurface}`}>
                <div className="flex items-center gap-3">
                  <img src={currentUser.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className={`font-bold text-sm truncate ${theme.textPrimary}`}>{currentUser.nome}</p>
                    <p className={`text-xs truncate ${theme.textSecondary}`}>@{currentUser.username}</p>
                  </div>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-slate-700/40 flex items-center justify-between text-xs">
                  <span className="text-indigo-400 font-semibold">
                    {currentUser.curso} • {currentUser.faculdade}
                  </span>
                </div>
              </div>

              {/* Menu Options */}
              <div className="space-y-1.5 flex-1">
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setIsPwaModalOpen(true);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 text-sm font-semibold ${theme.textPrimary} hover:bg-indigo-500/15 transition`}
                >
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span>Instalar App (PWA)</span>
                </button>

                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-full p-3 rounded-xl flex items-center justify-between text-sm font-semibold ${theme.textPrimary} hover:bg-indigo-500/15 transition`}
                >
                  <div className="flex items-center gap-3">
                    {darkMode ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
                    <span>Tema {darkMode ? 'Escuro' : 'Claro'}</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                    Alternar
                  </span>
                </button>

                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setIsSupabaseModalOpen(true);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center justify-between text-sm font-semibold ${theme.textPrimary} hover:bg-indigo-500/15 transition`}
                >
                  <div className="flex items-center gap-3">
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    <span>Configurar Supabase</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      supabaseConfig.connected ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                </button>

                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setIsSqlModalOpen(true);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 text-sm font-semibold ${theme.textPrimary} hover:bg-indigo-500/15 transition`}
                >
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span>Schema SQL & RLS Supabase</span>
                </button>
              </div>

              {/* Logout */}
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  setCurrentUserId(null);
                  showToast('Você saiu da conta.', 'info');
                }}
                className="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold text-rose-400 hover:bg-rose-500/10 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da conta</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. PWA INSTALLATION GUIDE MODAL (iOS & ANDROID) */}
        {isPwaModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-3xl border ${theme.border} ${theme.bgMain} p-6 shadow-2xl`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <CampusLogo size={32} />
                  <div>
                    <h3 className={`font-extrabold text-base ${theme.textPrimary}`}>Instalar Campus Conect</h3>
                    <p className={`text-[11px] ${theme.textSecondary}`}>Progressive Web App • Tela Cheia</p>
                  </div>
                </div>
                <button onClick={() => setIsPwaModalOpen(false)} className={theme.textSecondary}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* OS Tabs */}
              <div className={`grid grid-cols-2 p-1 rounded-xl mb-4 ${darkMode ? 'bg-slate-900' : 'bg-slate-200'}`}>
                <button
                  onClick={() => setPwaTab('ios')}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    pwaTab === 'ios' ? 'bg-indigo-600 text-white shadow' : theme.textSecondary
                  }`}
                >
                  iPhone (iOS / Safari)
                </button>
                <button
                  onClick={() => setPwaTab('android')}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    pwaTab === 'android' ? 'bg-indigo-600 text-white shadow' : theme.textSecondary
                  }`}
                >
                  Android (Chrome)
                </button>
              </div>

              {pwaTab === 'ios' ? (
                <div className="space-y-3 text-xs">
                  <div className={`p-3 rounded-2xl border ${theme.border} ${theme.bgSurface} flex items-start gap-3`}>
                    <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <p className={theme.textPrimary}>
                      Abra o <strong>Campus Conect</strong> no navegador <strong>Safari</strong> do seu iPhone.
                    </p>
                  </div>
                  <div className={`p-3 rounded-2xl border ${theme.border} ${theme.bgSurface} flex items-start gap-3`}>
                    <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <p className={theme.textPrimary}>
                      Toque no botão <strong>Compartilhar</strong>{' '}
                      <Share className="w-3.5 h-3.5 inline text-cyan-400 mx-0.5" /> na barra inferior do Safari.
                    </p>
                  </div>
                  <div className={`p-3 rounded-2xl border ${theme.border} ${theme.bgSurface} flex items-start gap-3`}>
                    <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <p className={theme.textPrimary}>
                      Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>, depois confirme em{' '}
                      <strong>Adicionar</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className={`p-3 rounded-2xl border ${theme.border} ${theme.bgSurface} flex items-start gap-3`}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <p className={theme.textPrimary}>
                      Abra o <strong>Campus Conect</strong> no <strong>Google Chrome</strong> do seu Android.
                    </p>
                  </div>
                  <div className={`p-3 rounded-2xl border ${theme.border} ${theme.bgSurface} flex items-start gap-3`}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <p className={theme.textPrimary}>
                      Toque no menu de três pontos{' '}
                      <MoreVertical className="w-3.5 h-3.5 inline text-cyan-400 mx-0.5" /> no canto superior direito.
                    </p>
                  </div>
                  <div className={`p-3 rounded-2xl border ${theme.border} ${theme.bgSurface} flex items-start gap-3`}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <p className={theme.textPrimary}>
                      Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>. O
                      ícone aparecerá junto aos seus apps nativos!
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-[11px] text-emerald-400">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Manifest PWA (`display: standalone`) e cache local configurados.</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. SUPABASE SQL SCHEMA & RLS VIEWER MODAL */}
        {isSqlModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className={`w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl border ${theme.border} ${theme.bgMain} p-5 shadow-2xl`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className={`font-extrabold text-base ${theme.textPrimary}`}>Schema PostgreSQL & RLS</h3>
                  <p className={`text-xs ${theme.textSecondary}`}>Cole este script no SQL Editor do seu Supabase</p>
                </div>
                <button onClick={() => setIsSqlModalOpen(false)} className={theme.textSecondary}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <pre className="flex-1 overflow-auto p-3.5 rounded-2xl bg-[#05070D] text-cyan-300 text-[11px] font-mono border border-slate-800 leading-relaxed">
                {SUPABASE_SQL_SCHEMA}
              </pre>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(SUPABASE_SQL_SCHEMA);
                    setSqlCopied(true);
                    showToast('Script SQL copiado! 📋');
                    setTimeout(() => setSqlCopied(false), 2500);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 flex items-center gap-1.5"
                >
                  {sqlCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{sqlCopied ? 'Copiado!' : 'Copiar SQL Completo'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. SUPABASE CREDENTIALS CONFIGURATION MODAL */}
        {isSupabaseModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-3xl border ${theme.border} ${theme.bgMain} p-5 shadow-2xl`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-extrabold text-base ${theme.textPrimary}`}>Conexão Backend Supabase</h3>
                <button onClick={() => setIsSupabaseModalOpen(false)} className={theme.textSecondary}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className={`text-xs mb-4 ${theme.textSecondary}`}>
                Insira sua <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_ANON_KEY</strong> para vincular seu
                projeto real ou mantenha o modo local persistente ativo.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className={`block font-semibold mb-1 ${theme.textSecondary}`}>Project URL</label>
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={supabaseConfig.url}
                    onChange={(e) => setSupabaseConfig({ ...supabaseConfig, url: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded-xl border ${theme.inputBg}`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${theme.textSecondary}`}>Anon Public Key</label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supabaseConfig.anonKey}
                    onChange={(e) => setSupabaseConfig({ ...supabaseConfig, anonKey: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded-xl border ${theme.inputBg}`}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setSupabaseConfig({ url: '', anonKey: '', connected: false });
                    setIsSupabaseModalOpen(false);
                    showToast('Usando armazenamento local persistente', 'info');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${theme.border} ${theme.textSecondary}`}
                >
                  Modo Local
                </button>
                <button
                  onClick={() => {
                    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
                      showToast('Preencha URL e Anon Key', 'error');
                      return;
                    }
                    setSupabaseConfig({ ...supabaseConfig, connected: true });
                    setIsSupabaseModalOpen(false);
                    showToast('Configuração Supabase salva! ⚡');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-cyan-500"
                >
                  Salvar Chaves
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. DELETE POST CONFIRMATION MODAL */}
        {confirmDeletePostId && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-xs rounded-3xl border ${theme.border} ${theme.bgMain} p-5 text-center shadow-2xl`}>
              <div className="w-11 h-11 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className={`font-extrabold text-base ${theme.textPrimary}`}>Excluir este post?</h4>
              <p className={`text-xs mt-1 ${theme.textSecondary}`}>
                Essa ação não pode ser desfeita e removerá o post do feed da universidade.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmDeletePostId(null)}
                  className={`py-2 rounded-xl text-xs font-bold border ${theme.border} ${theme.textPrimary}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeletePost(confirmDeletePostId)}
                  className="py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. TOAST FEEDBACK */}
        {toast && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-slate-900/95 text-white border border-indigo-500/40 shadow-xl flex items-center gap-2 text-xs font-semibold animate-bounce">
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}