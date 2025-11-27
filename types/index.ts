export interface Task {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  deadline: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at?: string;
  file_url?: string;
}

export interface Profile {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  rating?: number;
  completed_tasks?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Application {
  id: string;
  task_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
  created_at: string;
  updated_at?: string;
  user?: Profile;
  task?: Task;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  file_url?: string;
  created_at: string;
  read_at?: string;
  sender?: Profile;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message?: string;
  last_message_at: string;
  created_at: string;
  other_user?: Profile;
  unread_count?: number;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface TaskFormData {
  title: string;
  description: string;
  category: string;
  budget: string | number;
  deadline: string;
  file?: File | null;
}

export interface AuthState {
  user: Profile | null;
  session: any | null;
  loading: boolean;
  error: string | null;
}
