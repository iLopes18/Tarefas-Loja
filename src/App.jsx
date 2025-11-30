import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
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
  Calendar, 
  LogOut,
  AlertTriangle
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
// 1. Vá ao Firebase Console > Project Settings > General > Your apps
// 2. Copie o objeto 'firebaseConfig' e substitua o objeto abaixo:
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
// Definimos um ID fixo para a app já que é um site único
const appId = "app-lojas-geral"; 

// --- UTILITÁRIOS DE DATA ---
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
  const dayOfWeek = now.getDay(); 
  const d = new Date();
  const daysSinceSaturday = (d.getDay() + 1) % 7; 
  d.setDate(d.getDate() - daysSinceSaturday);
  d.setHours(23, 59, 0, 0);
  
  if (d > now) {
    d.setDate(d.getDate() - 7);
  }
  return d;
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [storeName, setStoreName] = useState('');
  const [activeStore, setActiveStore] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(DAYS[0].id);
  const [newTaskText, setNewTaskText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch((error) => {
        console.error("Erro no login anónimo:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      const savedStore = localStorage.getItem('myStoreName');
      if (savedStore) setActiveStore(savedStore);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !activeStore) return;

    setLoading(true);
    const storeRef = doc(db, 'lojas', activeStore.toLowerCase().trim());

    const unsubscribe = onSnapshot(storeRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let currentTasks = data.tasks || [];
        const lastReset = data.lastReset ? data.lastReset.toDate() : new Date(0);
        
        const shouldHaveResetAt = getLastResetTime();
        
        if (lastReset < shouldHaveResetAt) {
            console.log("A executar reset semanal...");
            setIsResetting(true);
            const resetTasks = currentTasks.map(t => ({ ...t, completed: false }));
            try {
              await updateDoc(storeRef, {
                tasks: resetTasks,
                lastReset: Timestamp.fromDate(new Date())
              });
            } catch (err) {
              console.error("Erro ao fazer reset:", err);
            }
            setIsResetting(false);
        } else {
            setTasks(currentTasks);
        }

      } else {
        await setDoc(storeRef, {
            tasks: [],
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

  const handleLoginStore = (e) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    const cleanName = storeName.trim().toUpperCase();
    localStorage.setItem('myStoreName', cleanName);
    setActiveStore(cleanName);
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

    const storeRef = doc(db, 'lojas', activeStore.toLowerCase().trim());
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
    const storeRef = doc(db, 'lojas', activeStore.toLowerCase().trim());
    await updateDoc(storeRef, { tasks: updatedTasks });
  };

  const deleteTask = async (task) => {
    if(!confirm("Tem a certeza?")) return;
    const storeRef = doc(db, 'lojas', activeStore.toLowerCase().trim());
    await updateDoc(storeRef, { tasks: arrayRemove(task) });
  };

  const currentDayTasks = useMemo(() => tasks.filter(t => t.day === selectedDay), [tasks, selectedDay]);
  const progress = useMemo(() => {
    if (currentDayTasks.length === 0) return 0;
    const completed = currentDayTasks.filter(t => t.completed).length;
    return Math.round((completed / currentDayTasks.length) * 100);
  }, [currentDayTasks]);

  if (!user) return <div className="min-h-screen flex items-center justify-center">A carregar...</div>;

  if (!activeStore) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="flex justify-center mb-6"><Store className="w-10 h-10 text-blue-600" /></div>
          <h1 className="text-2xl font-bold text-center mb-2">Login da Loja</h1>
          <form onSubmit={handleLoginStore} className="space-y-4">
            <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Nome da Loja" className="w-full p-3 border rounded-lg" required />
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex justify-between items-center mb-4">
          <h1 className="font-bold truncate">{activeStore}</h1>
          <button onClick={handleLogout} className="text-red-500 text-sm flex items-center gap-1"><LogOut size={16}/> Sair</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 max-w-3xl mx-auto">
          {DAYS.map(day => {
             const hasPending = tasks.some(t => t.day === day.id && !t.completed);
             return (
              <button key={day.id} onClick={() => setSelectedDay(day.id)} className={`p-3 rounded-xl min-w-[64px] flex flex-col items-center ${selectedDay === day.id ? 'bg-blue-600 text-white' : 'bg-white border text-slate-500'}`}>
                <span className="text-xs font-bold uppercase">{day.label.substr(0, 3)}</span>
                {hasPending && selectedDay !== day.id && <span className="w-2 h-2 bg-red-400 rounded-full mt-1"></span>}
              </button>
            )
          })}
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4">
        {isResetting && <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg flex items-center gap-2 mb-4"><AlertTriangle/> A reiniciar semana...</div>}
        
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-2xl font-bold">{DAYS.find(d => d.id === selectedDay)?.label}</h2>
          <span className="text-2xl font-bold text-blue-600">{progress}%</span>
        </div>

        <div className="space-y-3">
          {currentDayTasks.map(task => (
            <div key={task.id} className={`flex items-center p-4 bg-white rounded-xl border ${task.completed ? 'opacity-60' : ''}`}>
              <button onClick={() => toggleTask(task)} className="mr-4">{task.completed ? <CheckCircle2 className="text-green-500"/> : <Circle className="text-slate-300"/>}</button>
              <span className={`flex-1 ${task.completed ? 'line-through' : ''}`}>{task.text}</span>
              <button onClick={() => deleteTask(task)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <form onSubmit={handleAddTask} className="max-w-3xl mx-auto flex gap-2">
          <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="Nova tarefa..." className="flex-1 p-3 bg-slate-100 rounded-xl" />
          <button type="submit" disabled={!newTaskText.trim()} className="bg-blue-600 text-white p-3 rounded-xl"><Plus/></button>
        </form>
      </div>
    </div>
  );
}