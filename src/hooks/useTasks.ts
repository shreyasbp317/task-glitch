import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DerivedTask, Metrics, Task } from '@/types';
import {
  computeAverageROI,
  computePerformanceGrade,
  computeRevenuePerHour,
  computeTimeEfficiency,
  computeTotalRevenue,
  withDerived,
  sortTasks as sortDerived,
} from '@/utils/logic';
import { generateSalesTasks } from '@/utils/seed';

interface UseTasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  derivedSorted: DerivedTask[];
  metrics: Metrics;
  lastDeleted: Task | null;
  addTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  undoDelete: () => void;
  clearLastDeleted: () => void;
}

const INITIAL_METRICS: Metrics = {
  totalRevenue: 0,
  totalTimeTaken: 0,
  timeEfficiencyPct: 0,
  revenuePerHour: 0,
  averageROI: 0,
  performanceGrade: 'Needs Improvement',
};

const STORAGE_KEY = 'taskglitch-tasks';

export function useTasks(): UseTasksState {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<Task | null>(null);
  const fetchedRef = useRef(false);

  function normalizeTasks(input: any[]): Task[] {
    const now = Date.now();
    return (Array.isArray(input) ? input : []).map((t, idx) => {
      const created = t.createdAt ? new Date(t.createdAt) : new Date(now - (idx + 1) * 24 * 3600 * 1000);
      const completed = t.completedAt || (t.status === 'Done' ? new Date(created.getTime() + 24 * 3600 * 1000).toISOString() : undefined);
      return {
        id: t.id,
        title: t.title,
        revenue: Number(t.revenue) ?? 0,
        timeTaken: Number(t.timeTaken) > 0 ? Number(t.timeTaken) : 1,
        priority: t.priority,
        status: t.status,
        notes: t.notes,
        createdAt: created.toISOString(),
        completedAt: completed,
      } as Task;
    });
  }

  // Save to localStorage whenever tasks change
  const saveToLocalStorage = useCallback((tasksToSave: Task[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksToSave));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, []);

  // Load from localStorage or fetch initial data
  useEffect(() => {
    let isMounted = true;
    
    async function load() {
      try {
        // First, try to load from localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        
        if (stored) {
          // If localStorage has data, use it
          const parsed = JSON.parse(stored);
          const normalized = normalizeTasks(parsed);
          if (isMounted) {
            setTasks(normalized);
            setLoading(false);
          }
          return;
        }

        // If no localStorage data, fetch from JSON file
        const res = await fetch('/tasks.json');
        if (!res.ok) throw new Error(`Failed to load tasks.json (${res.status})`);
        const data = (await res.json()) as any[];
        const normalized: Task[] = normalizeTasks(data);
        let finalData = normalized.length > 0 ? normalized : generateSalesTasks(50);
        
        if (isMounted) {
          setTasks(finalData);
          saveToLocalStorage(finalData);
        }
      } catch (e: any) {
        // If fetch fails, try to generate dummy data
        const dummyData = generateSalesTasks(50);
        if (isMounted) {
          setTasks(dummyData);
          saveToLocalStorage(dummyData);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          fetchedRef.current = true;
        }
      }
    }
    
    load();
    
    return () => {
      isMounted = false;
    };
  }, [saveToLocalStorage]);

  const derivedSorted = useMemo<DerivedTask[]>(() => {
    const withRoi = tasks.map(withDerived);
    return sortDerived(withRoi);
  }, [tasks]);

  const metrics = useMemo<Metrics>(() => {
    if (tasks.length === 0) return INITIAL_METRICS;
    const totalRevenue = computeTotalRevenue(tasks);
    const totalTimeTaken = tasks.reduce((s, t) => s + t.timeTaken, 0);
    const timeEfficiencyPct = computeTimeEfficiency(tasks);
    const revenuePerHour = computeRevenuePerHour(tasks);
    const averageROI = computeAverageROI(tasks);
    const performanceGrade = computePerformanceGrade(averageROI);
    return { totalRevenue, totalTimeTaken, timeEfficiencyPct, revenuePerHour, averageROI, performanceGrade };
  }, [tasks]);

  const addTask = useCallback((task: Omit<Task, 'id'> & { id?: string }) => {
    setTasks(prev => {
      const id = task.id ?? crypto.randomUUID();
      const timeTaken = task.timeTaken <= 0 ? 1 : task.timeTaken;
      const createdAt = new Date().toISOString();
      const status = task.status;
      const completedAt = status === 'Done' ? createdAt : undefined;
      const newTasks = [...prev, { ...task, id, timeTaken, createdAt, completedAt }];
      saveToLocalStorage(newTasks);
      return newTasks;
    });
  }, [saveToLocalStorage]);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(prev => {
      const next = prev.map(t => {
        if (t.id !== id) return t;
        const merged = { ...t, ...patch } as Task;
        if (t.status !== 'Done' && merged.status === 'Done' && !merged.completedAt) {
          merged.completedAt = new Date().toISOString();
        }
        return merged;
      });
      const final = next.map(t => (t.id === id && (patch.timeTaken ?? t.timeTaken) <= 0 ? { ...t, timeTaken: 1 } : t));
      saveToLocalStorage(final);
      return final;
    });
  }, [saveToLocalStorage]);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === id) || null;
      setLastDeleted(target);
      const newTasks = prev.filter(t => t.id !== id);
      saveToLocalStorage(newTasks);
      return newTasks;
    });
  }, [saveToLocalStorage]);

  const undoDelete = useCallback(() => {
    if (!lastDeleted) return;
    setTasks(prev => {
      const newTasks = [...prev, lastDeleted];
      saveToLocalStorage(newTasks);
      return newTasks;
    });
    setLastDeleted(null);
  }, [lastDeleted, saveToLocalStorage]);

  const clearLastDeleted = useCallback(() => {
    setLastDeleted(null);
  }, []);

  return { 
    tasks, 
    loading, 
    error, 
    derivedSorted, 
    metrics, 
    lastDeleted, 
    addTask, 
    updateTask, 
    deleteTask, 
    undoDelete,
    clearLastDeleted
  };
}