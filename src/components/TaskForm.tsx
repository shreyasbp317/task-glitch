import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Alert,
} from '@mui/material';
import { Task } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<Task, 'id'> & { id?: string }) => void;
  initial?: Task | null;
  existingTitles: string[];
}

export default function TaskForm({ open, onClose, onSubmit, initial, existingTitles }: Props) {
  const [title, setTitle] = useState('');
  const [revenue, setRevenue] = useState('');
  const [timeTaken, setTimeTaken] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('Medium');
  const [status, setStatus] = useState<Task['status']>('Todo');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');

  useEffect(() => {
    if (open) {
      if (initial) {
        setTitle(initial.title);
        setRevenue(String(initial.revenue));
        setTimeTaken(String(initial.timeTaken));
        setPriority(initial.priority);
        setStatus(initial.status);
        setNotes(initial.notes || '');
      } else {
        // Reset form
        setTitle('');
        setRevenue('');
        setTimeTaken('');
        setPriority('Medium');
        setStatus('Todo');
        setNotes('');
      }
      setErrors({});
      setSubmitError('');
    }
  }, [initial, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate title
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (!initial && existingTitles.includes(title.trim())) {
      newErrors.title = 'Title already exists';
    } else if (initial && title.trim() !== initial.title && existingTitles.includes(title.trim())) {
      newErrors.title = 'Title already exists';
    }

    // Validate revenue
    const revNum = Number(revenue);
    if (!revenue || revenue.trim() === '') {
      newErrors.revenue = 'Revenue is required';
    } else if (isNaN(revNum)) {
      newErrors.revenue = 'Revenue must be a number';
    } else if (revNum < 0) {
      newErrors.revenue = 'Revenue cannot be negative';
    }

    // Validate time taken
    const timeNum = Number(timeTaken);
    if (!timeTaken || timeTaken.trim() === '') {
      newErrors.timeTaken = 'Time is required';
    } else if (isNaN(timeNum)) {
      newErrors.timeTaken = 'Time must be a number';
    } else if (timeNum <= 0) {
      newErrors.timeTaken = 'Time must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    setSubmitError('');

    if (!validate()) {
      return;
    }

    try {
      const task: Omit<Task, 'id'> & { id?: string } = {
        title: title.trim(),
        revenue: Number(revenue),
        timeTaken: Number(timeTaken),
        priority,
        status,
        notes: notes.trim() || undefined,
        createdAt: initial?.createdAt || new Date().toISOString(),
        completedAt: initial?.completedAt || (status === 'Done' ? new Date().toISOString() : undefined),
      };

      if (initial?.id) {
        task.id = initial.id;
      }

      onSubmit(task);
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitError('Failed to save task. Please try again.');
    }
  };

  const handleClose = () => {
    setErrors({});
    setSubmitError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Edit Task' : 'Add New Task'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {submitError && (
            <Alert severity="error" onClose={() => setSubmitError('')}>
              {submitError}
            </Alert>
          )}

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!!errors.title}
            helperText={errors.title}
            fullWidth
            required
            autoFocus
          />

          <TextField
            label="Revenue ($)"
            type="number"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            error={!!errors.revenue}
            helperText={errors.revenue}
            fullWidth
            required
            inputProps={{ min: 0, step: 0.01 }}
          />

          <TextField
            label="Time Taken (hours)"
            type="number"
            value={timeTaken}
            onChange={(e) => setTimeTaken(e.target.value)}
            error={!!errors.timeTaken}
            helperText={errors.timeTaken}
            fullWidth
            required
            inputProps={{ min: 0.1, step: 0.1 }}
          />

          <TextField
            label="Priority"
            select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task['priority'])}
            fullWidth
          >
            <MenuItem value="High">High</MenuItem>
            <MenuItem value="Medium">Medium</MenuItem>
            <MenuItem value="Low">Low</MenuItem>
          </TextField>

          <TextField
            label="Status"
            select
            value={status}
            onChange={(e) => setStatus(e.target.value as Task['status'])}
            fullWidth
          >
            <MenuItem value="Todo">Todo</MenuItem>
            <MenuItem value="In Progress">In Progress</MenuItem>
            <MenuItem value="Done">Done</MenuItem>
          </TextField>

          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {initial ? 'Save Changes' : 'Add Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}