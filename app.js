/**
 * TaskFlow - Modern To-Do & Productivity Web Application
 * Fully self-contained, offline-first with LocalStorage persistence.
 */

// ==========================================
// 1. Initial State & Defaults
// ==========================================
const DEFAULT_CATEGORIES = [
  { id: 'cat-work', name: 'Work', color: '#6366f1' },
  { id: 'cat-personal', name: 'Personal', color: '#06b6d4' },
  { id: 'cat-study', name: 'Study & Learning', color: '#10b981' },
  { id: 'cat-health', name: 'Health & Fitness', color: '#ec4899' },
  { id: 'cat-shopping', name: 'Shopping', color: '#f59e0b' }
];

const getTodayDateString = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const DEFAULT_TASKS = [
  {
    id: 'task-1',
    title: 'Welcome to TaskFlow! 🎉 Explore your new task manager',
    notes: 'Click the star icon to pin important tasks, or click edit to manage subtasks and notes.',
    dueDate: getTodayDateString(0),
    priority: 'high',
    category: 'cat-personal',
    completed: false,
    starred: true,
    subtasks: [
      { id: 'sub-1', title: 'Check off a task to hear the completion chime', completed: false },
      { id: 'sub-2', title: 'Try switching to Light / Dark mode in the top right', completed: false },
      { id: 'sub-3', title: 'Start a 25-minute Pomodoro focus session', completed: false }
    ],
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'task-2',
    title: 'Review weekly goals & quarterly milestones',
    notes: 'Prioritize strategic planning and team sync.',
    dueDate: getTodayDateString(0),
    priority: 'urgent',
    category: 'cat-work',
    completed: false,
    starred: true,
    subtasks: [],
    createdAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'task-3',
    title: 'Read chapter 4 of Clean Architecture book',
    notes: 'Focus on dependency inversion and interface segregation principles.',
    dueDate: getTodayDateString(1),
    priority: 'medium',
    category: 'cat-study',
    completed: false,
    starred: false,
    subtasks: [],
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'task-4',
    title: 'Evening workout & 5km outdoor run',
    notes: 'Remember hydration and stretching.',
    dueDate: getTodayDateString(0),
    priority: 'low',
    category: 'cat-health',
    completed: true,
    starred: false,
    subtasks: [],
    createdAt: new Date(Date.now() - 90000000).toISOString()
  }
];

class TaskFlowApp {
  constructor() {
    this.tasks = this.loadStorage('taskflow_tasks', DEFAULT_TASKS);
    this.categories = this.loadStorage('taskflow_categories', DEFAULT_CATEGORIES);
    this.theme = localStorage.getItem('taskflow_theme') || 'dark';
    this.soundEnabled = localStorage.getItem('taskflow_sound') !== 'false';

    this.currentView = 'all'; // 'all', 'today', 'upcoming', 'starred', 'completed', or category id
    this.priorityFilter = 'all';
    this.sortBy = 'created_desc';
    this.searchQuery = '';
    
    // For Undo
    this.lastDeletedTask = null;
    this.toastTimeout = null;

    // Pomodoro Timer State
    this.pomoDuration = 25 * 60; // 25 min
    this.pomoRemaining = this.pomoDuration;
    this.pomoInterval = null;
    this.pomoIsRunning = false;
    this.pomoMode = 'work'; // 'work' | 'break'

    this.audioCtx = null;

    this.init();
  }

  loadStorage(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (e) {
      console.error(`Error loading ${key}:`, e);
      return defaultVal;
    }
  }

  saveStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error(`Error saving ${key}:`, e);
    }
  }

  init() {
    this.applyTheme(this.theme);
    this.bindEvents();
    this.populateCategorySelects();
    this.renderCategoryNav();
    this.renderTasks();
    this.updateStats();
    this.updatePomodoroDisplay();

    // Auto set today's date in quick task form
    const dueInput = document.getElementById('taskDueDateInput');
    if (dueInput) {
      dueInput.value = getTodayDateString(0);
    }
  }

  // ==========================================
  // 2. Audio & Sound FX (Synthesizer via Web Audio)
  // ==========================================
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playCompletionChime() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 chord arpeggio

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);

        gain.gain.setValueAtTime(0, now + i * 0.07);
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.36);
      });
    } catch (e) {
      console.log('Audio playback prevented or unsupported:', e);
    }
  }

  playTimerChime() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.2, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.55);
      });
    } catch (e) {}
  }

  // ==========================================
  // 3. Canvas Confetti System
  // ==========================================
  launchConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.4,
        w: Math.random() * 8 + 4,
        h: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 14,
        vy: Math.random() * -12 - 4,
        gravity: 0.35,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        alpha: 1
      });
    }

    let animationId;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let activeCount = 0;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.alpha -= 0.012;

        if (p.alpha > 0) {
          activeCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      });

      if (activeCount > 0) {
        animationId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cancelAnimationFrame(animationId);
      }
    };

    render();
  }

  // ==========================================
  // 4. DOM Event Bindings
  // ==========================================
  bindEvents() {
    // Mobile Sidebar Drawer
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const sidebar = document.getElementById('sidebar');

    if (mobileMenuBtn && sidebar) {
      mobileMenuBtn.addEventListener('click', () => sidebar.classList.add('open'));
    }
    if (closeSidebarBtn && sidebar) {
      closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
    }

    // Nav Items switching
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const view = item.getAttribute('data-view');
        if (view) {
          this.switchView(view);
          if (sidebar) sidebar.classList.remove('open');
        }
      });
    });

    // Theme toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Sound toggle
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      this.updateSoundIcon();
      soundBtn.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('taskflow_sound', this.soundEnabled);
        this.updateSoundIcon();
        this.showToast(this.soundEnabled ? 'Sound effects enabled 🔔' : 'Sound effects muted 🔕');
      });
    }

    // Quick Task Form
    const quickForm = document.getElementById('quickTaskForm');
    if (quickForm) {
      quickForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleAddTask();
      });
    }

    // Toggle Notes Field in Form
    const toggleNotesBtn = document.getElementById('toggleNotesBtn');
    const notesWrapper = document.getElementById('creatorNotesWrapper');
    if (toggleNotesBtn && notesWrapper) {
      toggleNotesBtn.addEventListener('click', () => {
        const isHidden = notesWrapper.style.display === 'none';
        notesWrapper.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          document.getElementById('taskNotesInput').focus();
        }
      });
    }

    // Filter & Sort
    const prioritySelect = document.getElementById('priorityFilterSelect');
    if (prioritySelect) {
      prioritySelect.addEventListener('change', (e) => {
        this.priorityFilter = e.target.value;
        this.renderTasks();
      });
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.renderTasks();
      });
    }

    // Search Input
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        if (searchClearBtn) {
          searchClearBtn.style.display = this.searchQuery ? 'block' : 'none';
        }
        this.renderTasks();
      });
    }
    if (searchClearBtn && searchInput) {
      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        searchClearBtn.style.display = 'none';
        this.renderTasks();
      });
    }

    // Clear Completed Button
    const clearCompletedBtn = document.getElementById('clearCompletedBtn');
    if (clearCompletedBtn) {
      clearCompletedBtn.addEventListener('click', () => this.clearCompletedTasks());
    }

    // Sidebar New Task Button & Empty state add button
    const sidebarNewTaskBtn = document.getElementById('sidebarNewTaskBtn');
    const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
    const focusNewTask = () => {
      const input = document.getElementById('taskTitleInput');
      if (input) {
        input.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    if (sidebarNewTaskBtn) sidebarNewTaskBtn.addEventListener('click', focusNewTask);
    if (emptyStateAddBtn) emptyStateAddBtn.addEventListener('click', focusNewTask);

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in an input/textarea
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (['input', 'textarea', 'select'].includes(activeTag)) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
          this.closeModals();
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        const s = document.getElementById('searchInput');
        if (s) s.focus();
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        focusNewTask();
      } else if (e.key === 'Escape') {
        this.closeModals();
      }
    });

    // Modals setup
    this.setupEditModal();
    this.setupCategoryModal();
    this.setupSettingsModal();
    this.setupPomodoro();
  }

  // ==========================================
  // 5. Theme & Sound Management
  // ==========================================
  applyTheme(theme) {
    this.theme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('taskflow_theme', theme);

    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    if (sunIcon && moonIcon) {
      if (theme === 'dark') {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      }
    }
  }

  toggleTheme() {
    const next = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
  }

  updateSoundIcon() {
    const soundBtn = document.getElementById('soundToggleBtn');
    if (!soundBtn) return;
    soundBtn.style.opacity = this.soundEnabled ? '1' : '0.5';
    soundBtn.title = this.soundEnabled ? 'Sound is ON (Click to mute)' : 'Sound is MUTED (Click to unmute)';
  }

  // ==========================================
  // 6. Categories & Views
  // ==========================================
  populateCategorySelects() {
    const select = document.getElementById('taskCategoryInput');
    const editSelect = document.getElementById('editTaskCategory');

    const optionsHtml = this.categories
      .map(cat => `<option value="${cat.id}">${cat.name}</option>`)
      .join('');

    if (select) select.innerHTML = optionsHtml;
    if (editSelect) editSelect.innerHTML = optionsHtml;
  }

  renderCategoryNav() {
    const container = document.getElementById('categoryNavList');
    if (!container) return;

    container.innerHTML = this.categories
      .map(cat => {
        const count = this.tasks.filter(t => t.category === cat.id && !t.completed).length;
        const isActive = this.currentView === cat.id ? 'active' : '';
        return `
          <li class="nav-item ${isActive}" data-view="${cat.id}">
            <span class="cat-dot" style="background-color: ${cat.color}"></span>
            <span>${this.escapeHtml(cat.name)}</span>
            <span class="count-badge">${count}</span>
          </li>
        `;
      })
      .join('');

    // Re-bind category clicks
    container.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.switchView(view);
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
      });
    });
  }

  switchView(viewId) {
    this.currentView = viewId;

    // Update active class on all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    // Update title and subtitle
    const titleEl = document.getElementById('currentViewTitle');
    const subEl = document.getElementById('currentViewSubtitle');

    const viewTitles = {
      all: { title: 'All Tasks', sub: 'Keep track of your complete to-do list' },
      today: { title: "Today's Tasks", sub: 'Focus on what matters most today' },
      upcoming: { title: 'Upcoming Tasks', sub: 'Future scheduled priorities and deadlines' },
      starred: { title: 'Important & Starred', sub: 'High-priority items requiring attention' },
      completed: { title: 'Completed Archive', sub: 'All the tasks you have successfully finished' }
    };

    if (viewTitles[viewId]) {
      if (titleEl) titleEl.textContent = viewTitles[viewId].title;
      if (subEl) subEl.textContent = viewTitles[viewId].sub;
    } else {
      const cat = this.categories.find(c => c.id === viewId);
      if (cat) {
        if (titleEl) titleEl.textContent = cat.name;
        if (subEl) subEl.textContent = `All tasks categorized under ${cat.name}`;
      }
    }

    this.renderTasks();
  }

  // ==========================================
  // 7. Task Operations (Add, Toggle, Delete, Edit)
  // ==========================================
  handleAddTask() {
    const titleInput = document.getElementById('taskTitleInput');
    const notesInput = document.getElementById('taskNotesInput');
    const dueDateInput = document.getElementById('taskDueDateInput');
    const priorityInput = document.getElementById('taskPriorityInput');
    const categoryInput = document.getElementById('taskCategoryInput');

    const title = titleInput.value.trim();
    if (!title) return;

    const newTask = {
      id: 'task-' + Date.now(),
      title: title,
      notes: notesInput ? notesInput.value.trim() : '',
      dueDate: dueDateInput ? dueDateInput.value : '',
      priority: priorityInput ? priorityInput.value : 'medium',
      category: categoryInput ? categoryInput.value : (this.categories[0]?.id || 'cat-personal'),
      completed: false,
      starred: false,
      subtasks: [],
      createdAt: new Date().toISOString()
    };

    // If currently viewing a category, assign it to that category
    if (this.categories.some(c => c.id === this.currentView)) {
      newTask.category = this.currentView;
    }

    this.tasks.unshift(newTask);
    this.saveTasks();

    // Reset Form
    titleInput.value = '';
    if (notesInput) notesInput.value = '';
    const notesWrapper = document.getElementById('creatorNotesWrapper');
    if (notesWrapper) notesWrapper.style.display = 'none';

    this.renderTasks();
    this.updateStats();
    this.showToast('Task added successfully! 🚀');
  }

  toggleTaskComplete(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    this.saveTasks();

    if (task.completed) {
      this.playCompletionChime();
      this.launchConfetti();
      this.showToast(`Completed: "${task.title.slice(0, 30)}..." ✨`);
    }

    this.renderTasks();
    this.updateStats();
  }

  toggleTaskStar(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    task.starred = !task.starred;
    this.saveTasks();
    this.renderTasks();
    this.updateStats();
  }

  deleteTask(id) {
    const taskIndex = this.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const deleted = this.tasks.splice(taskIndex, 1)[0];
    this.lastDeletedTask = { task: deleted, index: taskIndex };
    this.saveTasks();
    this.renderTasks();
    this.updateStats();

    this.showToast(`Task removed`, true);
  }

  undoDelete() {
    if (!this.lastDeletedTask) return;
    const { task, index } = this.lastDeletedTask;
    this.tasks.splice(index, 0, task);
    this.lastDeletedTask = null;
    this.saveTasks();
    this.renderTasks();
    this.updateStats();
    this.showToast('Task restored! ↩️');
  }

  clearCompletedTasks() {
    const completedCount = this.tasks.filter(t => t.completed).length;
    if (completedCount === 0) {
      this.showToast('No completed tasks to clear.');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${completedCount} completed task(s)?`)) return;

    this.tasks = this.tasks.filter(t => !t.completed);
    this.saveTasks();
    this.renderTasks();
    this.updateStats();
    this.showToast(`Cleared ${completedCount} completed task(s)`);
  }

  saveTasks() {
    this.saveStorage('taskflow_tasks', this.tasks);
  }

  // ==========================================
  // 8. Task Rendering & Filtering
  // ==========================================
  getFilteredTasks() {
    const todayStr = getTodayDateString(0);

    return this.tasks.filter(task => {
      // 1. Search Query filter
      if (this.searchQuery) {
        const cat = this.categories.find(c => c.id === task.category);
        const catName = cat ? cat.name.toLowerCase() : '';
        const matchTitle = task.title.toLowerCase().includes(this.searchQuery);
        const matchNotes = (task.notes || '').toLowerCase().includes(this.searchQuery);
        const matchCategory = catName.includes(this.searchQuery);
        if (!matchTitle && !matchNotes && !matchCategory) return false;
      }

      // 2. Priority Filter
      if (this.priorityFilter !== 'all') {
        if (task.priority !== this.priorityFilter) return false;
      }

      // 3. View Filter
      if (this.currentView === 'all') {
        return true;
      } else if (this.currentView === 'today') {
        return task.dueDate === todayStr;
      } else if (this.currentView === 'upcoming') {
        return task.dueDate && task.dueDate > todayStr;
      } else if (this.currentView === 'starred') {
        return task.starred;
      } else if (this.currentView === 'completed') {
        return task.completed;
      } else {
        // Category view
        return task.category === this.currentView;
      }
    });
  }

  sortTasks(tasks) {
    const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };

    return [...tasks].sort((a, b) => {
      // Completed tasks stay at bottom within their group unless viewing completed view
      if (this.currentView !== 'completed') {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
      }

      if (this.sortBy === 'created_desc') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (this.sortBy === 'created_asc') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      } else if (this.sortBy === 'priority') {
        return (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
      } else if (this.sortBy === 'due_date') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      } else if (this.sortBy === 'alphabetical') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }

  renderTasks() {
    const filtered = this.getFilteredTasks();
    const sorted = this.sortTasks(filtered);

    const taskListEl = document.getElementById('taskList');
    const pinnedListEl = document.getElementById('pinnedTaskList');
    const pinnedGroupEl = document.getElementById('pinnedTasksGroup');
    const emptyStateEl = document.getElementById('emptyState');

    if (!taskListEl) return;

    if (sorted.length === 0) {
      taskListEl.innerHTML = '';
      if (pinnedListEl) pinnedListEl.innerHTML = '';
      if (pinnedGroupEl) pinnedGroupEl.style.display = 'none';
      if (emptyStateEl) emptyStateEl.style.display = 'flex';
      return;
    }

    if (emptyStateEl) emptyStateEl.style.display = 'none';

    // Separate starred tasks when in 'all' view for a neat spotlight section
    let normalTasks = sorted;
    let starredTasks = [];

    if (this.currentView === 'all' && !this.searchQuery && this.priorityFilter === 'all') {
      starredTasks = sorted.filter(t => t.starred && !t.completed);
      normalTasks = sorted.filter(t => !(t.starred && !t.completed));
    }

    if (pinnedGroupEl && pinnedListEl) {
      if (starredTasks.length > 0) {
        pinnedGroupEl.style.display = 'block';
        pinnedListEl.innerHTML = starredTasks.map(t => this.generateTaskHtml(t)).join('');
      } else {
        pinnedGroupEl.style.display = 'none';
        pinnedListEl.innerHTML = '';
      }
    }

    taskListEl.innerHTML = normalTasks.map(t => this.generateTaskHtml(t)).join('');

    this.bindTaskItemEvents();
    this.updateStats();
  }

  generateTaskHtml(task) {
    const category = this.categories.find(c => c.id === task.category) || { name: 'General', color: '#6366f1' };
    const todayStr = getTodayDateString(0);
    const tomorrowStr = getTodayDateString(1);

    // Due date label & styling
    let dueDateLabel = '';
    let dueDateClass = 'due-date-badge';
    if (task.dueDate) {
      if (task.dueDate < todayStr && !task.completed) {
        dueDateLabel = `Overdue (${task.dueDate})`;
        dueDateClass += ' overdue';
      } else if (task.dueDate === todayStr) {
        dueDateLabel = 'Today';
        dueDateClass += ' today';
      } else if (task.dueDate === tomorrowStr) {
        dueDateLabel = 'Tomorrow';
      } else {
        dueDateLabel = task.dueDate;
      }
    }

    // Subtask count
    const totalSubtasks = task.subtasks ? task.subtasks.length : 0;
    const completedSubtasks = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;

    return `
      <li class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}" data-priority="${task.priority}">
        <div class="task-main-row">
          <label class="task-checkbox-wrap" aria-label="Mark completed">
            <input type="checkbox" class="task-checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
            <div class="custom-checkbox">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </label>

          <div class="task-content-wrap">
            <div class="task-title-line">
              <span class="task-title">${this.escapeHtml(task.title)}</span>
            </div>

            ${task.notes ? `<div class="task-notes">${this.escapeHtml(task.notes)}</div>` : ''}

            <div class="task-meta-row">
              <span class="meta-badge category-badge" style="border-left: 3px solid ${category.color}">
                ${this.escapeHtml(category.name)}
              </span>

              <span class="meta-badge priority-badge ${task.priority}">
                ${task.priority.toUpperCase()}
              </span>

              ${dueDateLabel ? `
                <span class="meta-badge ${dueDateClass}">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                  </svg>
                  ${dueDateLabel}
                </span>
              ` : ''}

              ${totalSubtasks > 0 ? `
                <span class="meta-badge subtask-badge-pill toggle-subtasks-drawer-btn" data-id="${task.id}" title="Toggle subtasks checklist">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                  ${completedSubtasks}/${totalSubtasks} steps
                </span>
              ` : ''}
            </div>

            <!-- Subtasks inline drawer -->
            ${totalSubtasks > 0 ? `
              <div class="task-subtasks-drawer" id="subtaskDrawer-${task.id}">
                ${task.subtasks.map(sub => `
                  <div class="subtask-drawer-row ${sub.completed ? 'completed' : ''}">
                    <input type="checkbox" class="subtask-drawer-checkbox" data-taskid="${task.id}" data-subid="${sub.id}" ${sub.completed ? 'checked' : ''}>
                    <span>${this.escapeHtml(sub.title)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <div class="task-actions">
            <!-- Star / Pin button -->
            <button class="action-btn star-btn ${task.starred ? 'starred' : ''}" data-id="${task.id}" title="${task.starred ? 'Unpin' : 'Star & Pin'}">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="${task.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </button>

            <!-- Edit button -->
            <button class="action-btn edit-btn" data-id="${task.id}" title="Edit Task">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>

            <!-- Delete button -->
            <button class="action-btn delete-btn" data-id="${task.id}" title="Delete Task">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </li>
    `;
  }

  bindTaskItemEvents() {
    // Checkbox toggle
    document.querySelectorAll('.task-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        this.toggleTaskComplete(id);
      });
    });

    // Star toggle
    document.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        this.toggleTaskStar(id);
      });
    });

    // Delete
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        this.deleteTask(id);
      });
    });

    // Edit
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        this.openEditModal(id);
      });
    });

    // Subtask checkbox click in drawer
    document.querySelectorAll('.subtask-drawer-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const taskId = e.target.getAttribute('data-taskid');
        const subId = e.target.getAttribute('data-subid');
        this.toggleSubtask(taskId, subId);
      });
    });

    // Toggle subtasks drawer collapse
    document.querySelectorAll('.toggle-subtasks-drawer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const drawer = document.getElementById(`subtaskDrawer-${id}`);
        if (drawer) {
          drawer.style.display = drawer.style.display === 'none' ? 'flex' : 'none';
        }
      });
    });
  }

  toggleSubtask(taskId, subId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    const sub = task.subtasks.find(s => s.id === subId);
    if (!sub) return;

    sub.completed = !sub.completed;
    this.saveTasks();

    if (sub.completed) {
      this.playCompletionChime();
    }

    this.renderTasks();
  }

  // ==========================================
  // 9. Stats & Counters
  // ==========================================
  updateStats() {
    const todayStr = getTodayDateString(0);

    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const pending = total - completed;

    const countAll = this.tasks.filter(t => !t.completed).length;
    const countToday = this.tasks.filter(t => t.dueDate === todayStr && !t.completed).length;
    const countUpcoming = this.tasks.filter(t => t.dueDate && t.dueDate > todayStr && !t.completed).length;
    const countStarred = this.tasks.filter(t => t.starred && !t.completed).length;
    const countCompleted = completed;

    // Badges in sidebar
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('countAll', countAll);
    setVal('countToday', countToday);
    setVal('countUpcoming', countUpcoming);
    setVal('countStarred', countStarred);
    setVal('countCompleted', countCompleted);

    // Topbar quick counter
    const quickCounter = document.getElementById('quickStatsCounter');
    if (quickCounter) {
      quickCounter.textContent = `${pending} pending`;
    }

    // Daily progress bar
    const todayTasks = this.tasks.filter(t => t.dueDate === todayStr);
    const todayDone = todayTasks.filter(t => t.completed).length;
    const todayTotal = todayTasks.length;

    let percentage = 0;
    if (todayTotal > 0) {
      percentage = Math.round((todayDone / todayTotal) * 100);
    } else if (total > 0) {
      percentage = Math.round((completed / total) * 100);
    }

    const progBar = document.getElementById('dailyProgressBar');
    const progText = document.getElementById('dailyProgressPercent');
    const progSub = document.getElementById('dailyProgressSubtext');

    if (progBar) progBar.style.width = `${percentage}%`;
    if (progText) progText.textContent = `${percentage}%`;
    if (progSub) {
      if (todayTotal > 0) {
        progSub.textContent = `${todayDone} of ${todayTotal} today's tasks completed`;
      } else {
        progSub.textContent = `${completed} of ${total} total completed`;
      }
    }

    this.renderCategoryNav();
  }

  // ==========================================
  // 10. Edit Modal & Subtasks Management
  // ==========================================
  setupEditModal() {
    const modal = document.getElementById('editModal');
    const closeBtn = document.getElementById('closeEditModalBtn');
    const cancelBtn = document.getElementById('cancelEditModalBtn');
    const form = document.getElementById('editTaskForm');
    const addSubtaskBtn = document.getElementById('addNewSubtaskBtn');
    const subtaskInput = document.getElementById('newSubtaskInput');

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (addSubtaskBtn && subtaskInput) {
      const addSub = () => {
        const text = subtaskInput.value.trim();
        if (!text) return;
        const taskId = document.getElementById('editTaskId').value;
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          if (!task.subtasks) task.subtasks = [];
          task.subtasks.push({
            id: 'sub-' + Date.now(),
            title: text,
            completed: false
          });
          subtaskInput.value = '';
          this.renderModalSubtasks(task);
        }
      };
      addSubtaskBtn.addEventListener('click', addSub);
      subtaskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addSub();
        }
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskId = document.getElementById('editTaskId').value;
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        task.title = document.getElementById('editTaskTitle').value.trim();
        task.notes = document.getElementById('editTaskNotes').value.trim();
        task.dueDate = document.getElementById('editTaskDueDate').value;
        task.priority = document.getElementById('editTaskPriority').value;
        task.category = document.getElementById('editTaskCategory').value;

        this.saveTasks();
        this.renderTasks();
        this.updateStats();
        closeModal();
        this.showToast('Task updated successfully! ✏️');
      });
    }
  }

  openEditModal(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskNotes').value = task.notes || '';
    document.getElementById('editTaskDueDate').value = task.dueDate || '';
    document.getElementById('editTaskPriority').value = task.priority;
    document.getElementById('editTaskCategory').value = task.category;

    this.renderModalSubtasks(task);

    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'flex';
  }

  renderModalSubtasks(task) {
    const list = document.getElementById('editSubtasksList');
    const progressTag = document.getElementById('editSubtaskProgress');
    if (!list) return;

    const subtasks = task.subtasks || [];
    const done = subtasks.filter(s => s.completed).length;

    if (progressTag) {
      progressTag.textContent = `${done}/${subtasks.length}`;
    }

    list.innerHTML = subtasks.map((sub, idx) => `
      <div class="subtask-modal-item ${sub.completed ? 'done' : ''}">
        <input type="checkbox" ${sub.completed ? 'checked' : ''} data-index="${idx}">
        <input type="text" value="${this.escapeHtml(sub.title)}" data-index="${idx}">
        <button type="button" class="remove-subtask-btn" data-index="${idx}" title="Remove step">&times;</button>
      </div>
    `).join('');

    // Events for modal subtasks
    list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        task.subtasks[idx].completed = e.target.checked;
        this.renderModalSubtasks(task);
      });
    });

    list.querySelectorAll('input[type="text"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        task.subtasks[idx].title = e.target.value.trim();
      });
    });

    list.querySelectorAll('.remove-subtask-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        task.subtasks.splice(idx, 1);
        this.renderModalSubtasks(task);
      });
    });
  }

  // ==========================================
  // 11. Add Category Modal
  // ==========================================
  setupCategoryModal() {
    const addCatBtn = document.getElementById('addCategoryBtn');
    const modal = document.getElementById('categoryModal');
    const closeBtn = document.getElementById('closeCategoryModalBtn');
    const cancelBtn = document.getElementById('cancelCategoryModalBtn');
    const form = document.getElementById('categoryForm');
    const colorPicker = document.getElementById('categoryColorPicker');

    let selectedColor = '#6366f1';

    if (colorPicker) {
      colorPicker.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          colorPicker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
          selectedColor = dot.getAttribute('data-color');
        });
      });
    }

    const openModal = () => {
      if (modal) modal.style.display = 'flex';
      const nameInput = document.getElementById('newCategoryName');
      if (nameInput) {
        nameInput.value = '';
        nameInput.focus();
      }
    };

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    if (addCatBtn) addCatBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('newCategoryName');
        const name = nameInput.value.trim();
        if (!name) return;

        const newCategory = {
          id: 'cat-' + Date.now(),
          name: name,
          color: selectedColor
        };

        this.categories.push(newCategory);
        this.saveStorage('taskflow_categories', this.categories);
        this.populateCategorySelects();
        this.renderCategoryNav();
        closeModal();
        this.showToast(`Category "${name}" created! 🏷️`);
      });
    }
  }

  // ==========================================
  // 12. Backup, Import & Reset
  // ==========================================
  setupSettingsModal() {
    const openBtn = document.getElementById('openSettingsBtn');
    const modal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('closeSettingsModalBtn');
    const exportBtn = document.getElementById('exportDataBtn');
    const importFileInput = document.getElementById('importFileInput');
    const resetBtn = document.getElementById('resetDataBtn');

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    if (openBtn) openBtn.addEventListener('click', () => {
      if (modal) modal.style.display = 'flex';
    });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Export JSON
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const backupData = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          tasks: this.tasks,
          categories: this.categories
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TaskFlow_Backup_${getTodayDateString(0)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Backup downloaded successfully! 💾');
      });
    }

    // Import JSON
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            if (Array.isArray(data.tasks)) {
              this.tasks = data.tasks;
              if (Array.isArray(data.categories)) {
                this.categories = data.categories;
              }
              this.saveTasks();
              this.saveStorage('taskflow_categories', this.categories);
              this.populateCategorySelects();
              this.renderCategoryNav();
              this.renderTasks();
              this.updateStats();
              closeModal();
              this.showToast('Data imported successfully! 🎉');
            } else {
              alert('Invalid backup file format. Expected a TaskFlow JSON export.');
            }
          } catch (err) {
            alert('Failed to parse backup file: ' + err.message);
          }
        };
        reader.readAsText(file);
      });
    }

    // Reset Data
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Warning: This will reset all tasks to the initial starter tasks. Continue?')) {
          this.tasks = DEFAULT_TASKS;
          this.categories = DEFAULT_CATEGORIES;
          this.saveTasks();
          this.saveStorage('taskflow_categories', this.categories);
          this.populateCategorySelects();
          this.renderCategoryNav();
          this.renderTasks();
          this.updateStats();
          closeModal();
          this.showToast('Database reset to defaults.');
        }
      });
    }
  }

  closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.style.display = 'none';
    });
  }

  // ==========================================
  // 13. Pomodoro Focus Timer
  // ==========================================
  setupPomodoro() {
    const toggleBtn = document.getElementById('pomoToggleBtn');
    const resetBtn = document.getElementById('pomoResetBtn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (this.pomoIsRunning) {
          this.pausePomodoro();
        } else {
          this.startPomodoro();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetPomodoro();
      });
    }
  }

  startPomodoro() {
    this.pomoIsRunning = true;
    const toggleBtn = document.getElementById('pomoToggleBtn');
    if (toggleBtn) toggleBtn.textContent = 'Pause';

    clearInterval(this.pomoInterval);
    this.pomoInterval = setInterval(() => {
      this.pomoRemaining--;
      if (this.pomoRemaining <= 0) {
        this.handlePomodoroComplete();
      } else {
        this.updatePomodoroDisplay();
      }
    }, 1000);
  }

  pausePomodoro() {
    this.pomoIsRunning = false;
    clearInterval(this.pomoInterval);
    const toggleBtn = document.getElementById('pomoToggleBtn');
    if (toggleBtn) toggleBtn.textContent = 'Resume';
  }

  resetPomodoro() {
    this.pausePomodoro();
    this.pomoMode = 'work';
    this.pomoDuration = 25 * 60;
    this.pomoRemaining = this.pomoDuration;
    const modeBadge = document.getElementById('pomoModeBadge');
    if (modeBadge) modeBadge.textContent = 'Pomodoro';
    const toggleBtn = document.getElementById('pomoToggleBtn');
    if (toggleBtn) toggleBtn.textContent = 'Start';
    this.updatePomodoroDisplay();
  }

  handlePomodoroComplete() {
    this.pausePomodoro();
    this.playTimerChime();

    if (this.pomoMode === 'work') {
      this.pomoMode = 'break';
      this.pomoDuration = 5 * 60; // 5 min break
      this.pomoRemaining = this.pomoDuration;
      const modeBadge = document.getElementById('pomoModeBadge');
      if (modeBadge) modeBadge.textContent = '5m Break';
      this.showToast('Great focus session! 🧘 Time for a 5-minute break.');
    } else {
      this.pomoMode = 'work';
      this.pomoDuration = 25 * 60;
      this.pomoRemaining = this.pomoDuration;
      const modeBadge = document.getElementById('pomoModeBadge');
      if (modeBadge) modeBadge.textContent = 'Pomodoro';
      this.showToast('Break finished! Ready to conquer the next task? 🎯');
    }

    this.updatePomodoroDisplay();
  }

  updatePomodoroDisplay() {
    const display = document.getElementById('pomoDisplay');
    if (!display) return;

    const mins = Math.floor(this.pomoRemaining / 60);
    const secs = this.pomoRemaining % 60;
    display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // ==========================================
  // 14. Toast Notifications
  // ==========================================
  showToast(message, allowUndo = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    let html = `<span>${message}</span>`;
    if (allowUndo) {
      html += `<button class="toast-undo-btn" id="toastUndoBtn">Undo</button>`;
    }
    toast.innerHTML = html;

    container.appendChild(toast);

    if (allowUndo) {
      const undoBtn = toast.querySelector('#toastUndoBtn');
      if (undoBtn) {
        undoBtn.addEventListener('click', () => {
          this.undoDelete();
          toast.remove();
        });
      }
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // ==========================================
  // 15. Helper Utilities
  // ==========================================
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.taskFlowApp = new TaskFlowApp();
});
