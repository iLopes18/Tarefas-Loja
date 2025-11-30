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
  ShoppingBag,
  Sun,
  Moon,
  Lock,
  Unlock,
  Megaphone,
  Check,
  Info,
  X,
  Share,
  MoreVertical,
  Download
} from 'lucide-react';

// --- LISTA DE LOJAS ---
const STORES = [
  "Loja 272",
  "Loja 201",
  "Loja 270"
];

// --- TAREFAS PADRÃO ---
const getDefaultTasks = () => {
  const defaults = [
    { text: "Fecho da GT da kw anterior", day: "seg" },
    { text: "Reunião das NI's às 14H", day: "seg" },
    { text: "Medidas de inventário", day: "seg" },
    { text: "Lançar códigos dos avariados inativos", day: "seg" },
    { text: "Verificar garantias pendentes", day: "seg" },
    { text: "Revisão de caixa", day: "ter" },
    { text: "RESI - Reunião com equipa de gestão", day: "ter" },
    { text: "Plano de FIFOS", day: "ter" },
    { text: "Quebras de ação 30%", day: "ter" },
    { text: "RESI - (30 min) com CV", day: "qua" },
    { text: "Análise do mapa de quebras", day: "qua" },
    { text: "Análise do LIDL PLUS", day: "qua" },
    { text: "Análise da Diferença de NF", day: "qui" },
    { text: "Análise do cockpit de RH", day: "qui" },
    { text: "Inconformidades e TS", day: "qui" },
    { text: "Relatório de furtos", day: "sex" },
    { text: "Análise do NPS", day: "sex" },
    { text: "VCP até ao final do dia", day: "sab" },
    { text: "VCP = 0", day: "sab" },
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
const APP_ID = "lojas-app-geral";

// --- FUNÇÃO DE REFERÊNCIA ---
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

const RESET_DAY_INDEX = 0; 
const RESET_HOUR = 23;     
const RESET_MINUTE = 59;   

const getLastResetTime = () => {
  const now = new Date();
  const d = new Date();
  const diffDays = (d.getDay() - RESET_DAY_INDEX + 7) % 7; 
  d.setDate(d.getDate() - diffDays);
  d.setHours(RESET_HOUR, RESET_MINUTE, 0, 0);
  if (d > now) {
    d.setDate(d.getDate() - 7);
  }
  return d;
};

const getTodayId = () => {
  const todayIndex = new Date().getDay();
  const todayObj = DAYS.find(d => d.index === todayIndex);
  return todayObj ? todayObj.id : 'seg';
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [activeStore, setActiveStore] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [selectedDay, setSelectedDay] = useState(getTodayId());
  const [newTaskText, setNewTaskText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  
  // Estado de Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // NOVO: Estado do Modal de Ajuda
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  // Tema
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Autenticação
  useEffect(() => {
    const initAuth = async () => { await signInAnonymously(auth); };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      const savedStore = localStorage.getItem('myStoreName');
      if (savedStore && STORES.includes(savedStore)) setActiveStore(savedStore);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Carregar Dados
  useEffect(() => {
    if (!user || !activeStore) return;
    setLoading(true);
    setSelectedDay(getTodayId());
    const storeRef = getStoreRef(activeStore);

    const unsubscribe = onSnapshot(storeRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let currentTasks = data.tasks || [];
        const lastReset = data.lastReset ? data.lastReset.toDate() : new Date(0);
        
        if (currentTasks.length === 0) {
            currentTasks = getDefaultTasks();
            await updateDoc(storeRef, { tasks: currentTasks });
        }

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

  // Ações
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

    try {
      if (isAdmin) {
        setFeedbackMsg('A adicionar a todas as lojas...');
        const promises = STORES.map(storeName => {
          const ref = getStoreRef(storeName);
          return setDoc(ref, { 
            tasks: arrayUnion(newTask) 
          }, { merge: true });
        });
        await Promise.all(promises);
        setFeedbackMsg(`Adicionado a ${STORES.length} lojas!`);
        setTimeout(() => setFeedbackMsg(''), 3000);
      } else {
        const storeRef = getStoreRef(activeStore);
        await updateDoc(storeRef, { tasks: arrayUnion(newTask) });
      }
      setNewTaskText('');
    } catch (err) { 
      console.error(err); 
      setFeedbackMsg('Erro ao adicionar');
    }
  };

  const toggleTask = async (task) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === task.id) return { ...t, completed: !t.completed };
      return t;
    });
    const storeRef = getStoreRef(activeStore);
    await updateDoc(storeRef, { tasks: updatedTasks });
  };

  const deleteTask = async (task) => {
    if(!confirm("Apagar tarefa?")) return;
    const storeRef = getStoreRef(activeStore);
    await updateDoc(storeRef, { tasks: arrayRemove(task) });
  };

  const currentDayTasks = useMemo(() => tasks.filter(t => t.day === selectedDay), [tasks, selectedDay]);
  const progress = useMemo(() => {
    if (currentDayTasks.length === 0) return 0;
    const completed = currentDayTasks.filter(t => t.completed).length;
    return Math.round((completed / currentDayTasks.length) * 100);
  }, [currentDayTasks]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!activeStore) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-900 dark:to-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-500">
        <div className="absolute top-4 right-4 flex gap-2">
            <button 
              onClick={() => setShowInstallHelp(true)}
              className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-blue-400 shadow-sm hover:shadow-md transition-all"
              title="Instalar App"
            >
              <Download size={20} />
            </button>
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-yellow-400 shadow-sm hover:shadow-md transition-all"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
        </div>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm inline-block mb-4 transition-colors">
              <ShoppingBag className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Selecione a Loja</h1>
            <p className="text-slate-500 dark:text-slate-400">Gestão de Tarefas Semanal</p>
          </div>
          <div className="grid gap-3">
            {STORES.map((store) => (
              <button key={store} onClick={() => selectStore(store)} className="group relative overflow-hidden bg-white dark:bg-slate-800 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all">
                <div className="flex items-center gap-4">
                  <MapPin className="w-5 h-5 text-slate-500 dark:text-slate-300 group-hover:text-white" />
                  <span className="font-semibold text-lg text-slate-700 dark:text-slate-200 group-hover:text-white">{store}</span>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-white" />
              </button>
            ))}
          </div>
          <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
            Reset automático {([0, 6].includes(RESET_DAY_INDEX) ? 'aos' : 'às')} {DAYS.find(d => d.index === RESET_DAY_INDEX)?.label}s
          </div>
        </div>
        
        {/* MODAL DE AJUDA INSTALAÇÃO (LOGIN) */}
        {showInstallHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Download className="text-blue-500"/> Instalar Aplicação
                </h2>
                <button onClick={() => setShowInstallHelp(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                {/* iOS Instructions */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                    <span className="bg-black text-white px-2 py-0.5 rounded text-xs">iOS</span> iPhone / iPad
                  </h3>
                  <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
                    <li>Toque no botão <strong>Partilhar</strong> <Share size={14} className="inline mx-1"/> na barra inferior.</li>
                    <li>Arraste para cima e escolha <strong>"Ecrã Principal"</strong> (Add to Home Screen).</li>
                    <li>Toque em <strong>Adicionar</strong>.</li>
                  </ol>
                </div>

                {/* Android Instructions */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                    <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs">Android</span> Chrome
                  </h3>
                  <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
                    <li>Toque nos <strong>3 pontos</strong> <MoreVertical size={14} className="inline mx-1"/> no canto superior.</li>
                    <li>Escolha <strong>"Instalar aplicação"</strong> ou "Adicionar ao ecrã principal".</li>
                    <li>Confirme em <strong>Instalar</strong>.</li>
                  </ol>
                </div>
              </div>
              
              <button 
                onClick={() => setShowInstallHelp(false)}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-24 transition-colors duration-500">
      <header className="bg-white dark:bg-slate-900 shadow-sm sticky top-0 z-20 transition-colors">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Store className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-slate-800 dark:text-white truncate max-w-[120px] sm:max-w-xs">{activeStore}</h1>
          </div>
          <div className="flex items-center gap-2">
            
            {/* Botão de Ajuda na Toolbar */}
            <button 
                onClick={() => setShowInstallHelp(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                title="Como Instalar"
            >
                <Info size={18} />
            </button>

            <button 
              onClick={() => setIsAdmin(!isAdmin)}
              className={`p-2 rounded-lg transition-all ${isAdmin ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              title="Modo Admin"
            >
              {isAdmin ? <Unlock size={18} /> : <Lock size={18} />}
            </button>
            
            <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-yellow-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors">
                <LogOut size={16}/> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
        
        {/* BARRA DE DIAS */}
        <div className="max-w-3xl mx-auto py-2 px-1 overflow-x-auto scrollbar-hide">
          <div className="flex justify-between min-w-max gap-2 px-3">
            {DAYS.map(day => {
               const hasPending = tasks.some(t => t.day === day.id && !t.completed);
               const isSelected = selectedDay === day.id;
               return (
                <button key={day.id} onClick={() => setSelectedDay(day.id)} className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                  <span className="text-[10px] font-bold uppercase">{day.label.substr(0, 3)}</span>
                  {hasPending && !isSelected && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-400 rounded-full"></span>}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 animate-in fade-in">
        {isResetting && <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-xl flex items-center gap-3"><AlertTriangle className="w-5 h-5"/> <span>Reiniciando semana...</span></div>}

        {feedbackMsg && (
          <div className="mb-4 p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-xl flex items-center justify-center gap-2 animate-bounce">
            <Megaphone size={18} />
            <span className="font-bold">{feedbackMsg}</span>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm mb-6 transition-colors">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{DAYS.find(d => d.id === selectedDay)?.label}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{currentDayTasks.length} tarefas hoje</p>
            </div>
            <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${progress === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div className="space-y-3">
            {currentDayTasks.map(task => (
              <div key={task.id} className={`flex items-center p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 ${task.completed ? 'opacity-60' : ''}`}>
                <button onClick={() => toggleTask(task)} className="mr-4">
                  {task.completed ? <CheckCircle2 className="w-6 h-6 text-green-500 dark:text-green-400"/> : <Circle className="w-6 h-6 text-slate-300 dark:text-slate-600"/>}
                </button>
                <span className={`flex-1 ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{task.text}</span>
                <button onClick={() => deleteTask(task)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
              </div>
            ))}
        </div>
      </main>

      <div className={`fixed bottom-0 left-0 right-0 backdrop-blur-md border-t p-4 shadow-lg z-20 transition-colors ${isAdmin ? 'bg-purple-50/90 dark:bg-purple-950/90 border-purple-200 dark:border-purple-800' : 'bg-white/80 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800'}`}>
        <form onSubmit={handleAddTask} className="max-w-3xl mx-auto flex gap-3">
          <input 
            type="text" 
            value={newTaskText} 
            onChange={(e) => setNewTaskText(e.target.value)} 
            placeholder={isAdmin ? "ADICIONAR A TODAS AS LOJAS..." : `Nova tarefa para ${DAYS.find(d => d.id === selectedDay)?.label}...`} 
            className={`flex-1 p-3.5 border-2 rounded-xl outline-none transition-all font-medium ${isAdmin ? 'bg-white dark:bg-slate-900 border-purple-300 focus:border-purple-600 placeholder:text-purple-400' : 'bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:text-slate-200'}`}
          />
          <button type="submit" disabled={!newTaskText.trim()} className={`text-white p-3 rounded-xl transition-all shadow-lg aspect-square flex items-center justify-center active:scale-95 ${isAdmin ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isAdmin ? <Megaphone className="w-6 h-6"/> : <Plus className="w-6 h-6"/>}
          </button>
        </form>
      </div>

      {/* MODAL DE AJUDA INSTALAÇÃO (APP) */}
      {showInstallHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Download className="text-blue-500"/> Instalar Aplicação
              </h2>
              <button onClick={() => setShowInstallHelp(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <h3 className="font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                  <span className="bg-black text-white px-2 py-0.5 rounded text-xs">iOS</span> iPhone / iPad
                </h3>
                <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
                  <li>Toque no botão <strong>Partilhar</strong> <Share size={14} className="inline mx-1"/> na barra inferior.</li>
                  <li>Arraste para cima e escolha <strong>"Ecrã Principal"</strong> (Add to Home Screen).</li>
                  <li>Toque em <strong>Adicionar</strong>.</li>
                </ol>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <h3 className="font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                  <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs">Android</span> Chrome
                </h3>
                <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
                  <li>Toque nos <strong>3 pontos</strong> <MoreVertical size={14} className="inline mx-1"/> no canto superior.</li>
                  <li>Escolha <strong>"Instalar aplicação"</strong> ou "Adicionar ao ecrã principal".</li>
                  <li>Confirme em <strong>Instalar</strong>.</li>
                </ol>
              </div>
            </div>
            
            <button 
              onClick={() => setShowInstallHelp(false)}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}