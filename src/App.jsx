import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  Timestamp 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  CheckCircle2, 
  Circle, 
  Store, 
  Plus, 
  Trash2, 
  LogOut,
  AlertTriangle,
  MapPin,
  ArrowRight,
  ShoppingBag
} from 'lucide-react';

// --- LISTA DE LOJAS ---
// Edite aqui os nomes das suas lojas
const STORES = [
  "Loja 272",
  "Loja 271",
  "Loja 270"
];

// --- TAREFAS PADRÃO (Isto preenche a loja quando ela está vazia) ---
// Pode editar ou adicionar mais linhas aqui
const getDefaultTasks = () => {
  const defaults = [
    // SEGUNDA
    { text: "Fecho da GT da kw anterior", day: "seg" },
    { text: "Reunião das NI's às 14H", day: "seg" },
    { text: "Medidas de inventário", day: "seg" },
    { text: "Lançar códigos dos avariados inativos", day: "seg" },
    { text: "Verificar garantias pendentes", day: "seg" },
    // TERÇA
    { text: "Revisão de caixa", day: "ter" },
    { text: "RESI - Reunião com equipa de gestão", day: "ter" },
    { text: "Plano de FIFOS", day: "ter" },
    { text: "Quebras de ação 30%", day: "ter" },
    // QUARTA
    { text: "RESI - (30 min) com CV", day: "qua" },
    { text: "Análise do mapa de quebras", day: "qua" },
    { text: "Análise do LIDL PLUS", day: "qua" },
    // QUINTA
    { text: "Análise da Diferença de NF", day: "qui" },
    { text: "Análise do cockpit de RH", day: "qui" },
    { text: "Inconformidades e TS", day: "qui" },
    // SEXTA
    { text: "Relatório de furtos", day: "sex" },
    { text: "Análise do NPS", day: "sex" },
    // SÁBADO
    { text: "VCP até ao final do dia", day: "sab" },
    { text: "VCP = 0", day: "sab" },
    // DOMINGO
    { text: "Verificar Easyplan", day: "dom" },
  ];

  return defaults.map(t => ({
    id: crypto.randomUUID(),
    text: t.text,
    day: t.day,
    completed: false,
    createdAt: new Date().toISOString()
  }));
};

// --- CONFIGURAÇÃO FIREBASE ---
// Certifique-se que estes dados correspondem ao seu projeto no Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyA-h2KUKkBFHnWiQHm8XGVE2L84tw11DkM",
  authDomain: "tarefas-loja.firebaseapp.com",
  projectId: "tarefas-loja",
  storageBucket: "tarefas-loja.firebasestorage.app",
  messagingSenderId: "29292875030",
  appId: "1:29292875030:web:ad6b5110cc625838995437",
  measurementId: "G-ZRS4B08BCL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID da App
const APP_ID = "lojas-app-geral";

// --- FUNÇÃO AUXILIAR PARA CRIAR REFERÊNCIA ---
// Corrige o erro dos "5 segments". Agora cria um caminho com 6 segmentos:
// artifacts -> APP_ID -> public -> data -> lojas -> NomeDaLoja
const getStoreRef = (storeName) => {
  return doc(db, 'artifacts', APP_ID, 'public', 'data', 'lojas', storeName.toLowerCase().trim());
};

// --- UTILITÁRIOS ---
const DAYS = [
  { id: 'seg', label: 'Segunda', index: 1 },
  { id: 'ter', label: 'Terça', index: 2 },
  { id: 'qua', label: 'Quarta', index: 3 },
  { id: 'qui', label: 'Quinta', index: 4 },
  { id: 'sex', label: 'Sexta', index: 5 },
  { id: 'sab', label: 'Sábado', index: 6 },
  { id: 'dom', label: 'Domingo', index: 0 },
];

const getLastResetTime = () => {
  const now = new Date();
  const d = new Date();
  const daysSinceSaturday = (d.getDay() + 1) % 7; 
  d.setDate(d.getDate() - daysSinceSaturday);
  d.setHours(23, 59, 0, 0);
  if (d > now) d.setDate(d.getDate() - 7);
  return d;
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [activeStore, setActiveStore] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(DAYS[0].id);
  const [newTaskText, setNewTaskText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // 1. Autenticação
  useEffect(() => {
    const initAuth = async () => {
       await signInAnonymously(auth);
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      const savedStore = localStorage.getItem('myStoreName');
      if (savedStore && STORES.includes(savedStore)) {
        setActiveStore(savedStore);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Carregar Dados
  useEffect(() => {
    if (!user || !activeStore) return;
    setLoading(true);
    
    // USAR A NOVA FUNÇÃO DE REFERÊNCIA (CORRIGIDO)
    const storeRef = getStoreRef(activeStore);

    const unsubscribe = onSnapshot(storeRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let currentTasks = data.tasks || [];
        const lastReset = data.lastReset ? data.lastReset.toDate() : new Date(0);
        
        // Auto-preenchimento se vazio
        if (currentTasks.length === 0) {
            currentTasks = getDefaultTasks();
            await updateDoc(storeRef, { tasks: currentTasks });
        }

        // Reset Automático
        const shouldHaveResetAt = getLastResetTime();
        if (lastReset < shouldHaveResetAt) {
            setIsResetting(true);
            const resetTasks = currentTasks.map(t => ({ ...t, completed: false }));
            try {
              await updateDoc(storeRef, {
                tasks: resetTasks,
                lastReset: Timestamp.fromDate(new Date())
              });
            } catch (err) { console.error("Erro reset:", err); }
            setIsResetting(false);
        } else {
            setTasks(currentTasks);
        }

      } else {
        // Criar loja nova
        await setDoc(storeRef, {
            tasks: getDefaultTasks(),
            createdAt: Timestamp.now(),
            lastReset: Timestamp.now()
        });
      }
      setLoading(false);
    }, (error) => {
        console.error("Erro ao ler dados:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeStore]);

  // --- AÇÕES ---

  const selectStore = (storeName) => {
    localStorage.setItem('myStoreName', storeName);
    setActiveStore(storeName);
  };

  const handleLogout = () => {
    localStorage.removeItem('myStoreName');
    setActiveStore(null);
    setTasks([]);
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask = {
      id: crypto.randomUUID(),
      text: newTaskText,
      day: selectedDay,
      completed: false,
      createdAt: new Date().toISOString()
    };

    // USAR A NOVA FUNÇÃO DE REFERÊNCIA
    const storeRef = getStoreRef(activeStore);
    
    try {
      await updateDoc(storeRef, { tasks: arrayUnion(newTask) });
      setNewTaskText('');
    } catch (err) { console.error(err); }
  };

  const toggleTask = async (task) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === task.id) return { ...t, completed: !t.completed };
      return t;
    });
    // USAR A NOVA FUNÇÃO DE REFERÊNCIA
    const storeRef = getStoreRef(activeStore);
    await updateDoc(storeRef, { tasks: updatedTasks });
  };

  const deleteTask = async (task) => {
    if(!confirm("Apagar tarefa?")) return;
    // USAR A NOVA FUNÇÃO DE REFERÊNCIA
    const storeRef = getStoreRef(activeStore);
    await updateDoc(storeRef, { tasks: arrayRemove(task) });
  };

  // --- RENDERIZAÇÃO ---
  const currentDayTasks = useMemo(() => tasks.filter(t => t.day === selectedDay), [tasks, selectedDay]);
  const progress = useMemo(() => {
    if (currentDayTasks.length === 0) return 0;
    const completed = currentDayTasks.filter(t => t.completed).length;
    return Math.round((completed / currentDayTasks.length) * 100);
  }, [currentDayTasks]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!activeStore) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-white p-4 rounded-2xl shadow-sm inline-block mb-4">
              <ShoppingBag className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Selecione a Loja</h1>
            <p className="text-slate-500">Gestão de Tarefas Semanal</p>
          </div>
          <div className="grid gap-3">
            {STORES.map((store) => (
              <button
                key={store}
                onClick={() => selectStore(store)}
                className="group relative overflow-hidden bg-white hover:bg-blue-600 hover:text-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-600 transition-all duration-300 flex items-center justify-between"
              >
                <div className="flex items-center gap-4 z-10">
                  <div className="bg-slate-100 group-hover:bg-white/20 p-2 rounded-lg transition-colors">
                    <MapPin className="w-5 h-5 text-slate-500 group-hover:text-white" />
                  </div>
                  <span className="font-semibold text-lg">{store}</span>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-white transform group-hover:translate-x-1 transition-all z-10" />
              </button>
            ))}
          </div>
          <div className="mt-8 text-center text-xs text-slate-400">Reset automático aos Sábados</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Store className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-slate-800 truncate">{activeStore}</h1>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors">
            <LogOut size={16}/> <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
        <div className="max-w-3xl mx-auto py-2 px-1 overflow-x-auto scrollbar-hide">
          <div className="flex justify-between min-w-max gap-2 px-3">
            {DAYS.map(day => {
               const hasPending = tasks.some(t => t.day === day.id && !t.completed);
               const isSelected = selectedDay === day.id;
               return (
                <button key={day.id} onClick={() => setSelectedDay(day.id)} className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 transform -translate-y-1' : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-100'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{day.label.substr(0, 3)}</span>
                  {hasPending && !isSelected && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-400 rounded-full"></span>}
                  {isSelected && <div className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full"></div>}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 animate-in fade-in duration-500">
        {isResetting && <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-center gap-3 animate-pulse"><AlertTriangle className="w-5 h-5"/> <span className="font-medium">A reiniciar a semana...</span></div>}

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{DAYS.find(d => d.id === selectedDay)?.label}</h2>
              <p className="text-slate-500 text-sm">{currentDayTasks.length} {currentDayTasks.length === 1 ? 'tarefa' : 'tarefas'} hoje</p>
            </div>
            <div className="text-right">
              <span className="text-4xl font-bold text-blue-600 tracking-tight">{progress}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ease-out ${progress === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div className="space-y-3">
          {currentDayTasks.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-white/50 rounded-2xl border-2 border-dashed border-slate-200">
               <div className="bg-slate-100 p-4 rounded-full mb-3"><CheckCircle2 className="w-8 h-8 text-slate-300" /></div>
               <p className="font-medium">Tudo limpo por hoje!</p>
               <p className="text-sm">Adicione tarefas no botão (+)</p>
             </div>
          ) : (
            currentDayTasks.map(task => (
              <div key={task.id} className={`group flex items-center p-4 bg-white rounded-xl border transition-all duration-200 ${task.completed ? 'border-transparent bg-slate-50/80 opacity-60' : 'border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md'}`}>
                <button onClick={() => toggleTask(task)} className="mr-4 focus:outline-none transition-transform active:scale-90">
                  {task.completed ? <CheckCircle2 className="w-6 h-6 text-green-500"/> : <Circle className="w-6 h-6 text-slate-300 hover:text-blue-500"/>}
                </button>
                <span className={`flex-1 font-medium transition-colors ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.text}</span>
                <button onClick={() => deleteTask(task)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all" title="Apagar"><Trash2 size={18}/></button>
              </div>
            ))
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 shadow-lg z-20">
        <form onSubmit={handleAddTask} className="max-w-3xl mx-auto flex gap-3">
          <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder={`Nova tarefa para ${DAYS.find(d => d.id === selectedDay)?.label}...`} className="flex-1 p-3.5 bg-slate-100 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400" />
          <button type="submit" disabled={!newTaskText.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white p-3 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 aspect-square flex items-center justify-center active:scale-95"><Plus className="w-6 h-6"/></button>
        </form>
      </div>
    </div>
  );
}