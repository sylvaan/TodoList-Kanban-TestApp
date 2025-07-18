import { CommonModule } from '@angular/common';
import { Component, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import moment from 'moment';

interface Task {
  id: number;
  task: string;
  developer: string;
  status: string;
  priority: string;
  type: string;
  date: string;
  estimatedSP: number;
  actualSP: number;
  editing: any;
  originalData?: any;
}

interface ApiResponse {
  response: boolean;
  data: {
    title: string;
    developer: string;
    priority: string;
    status: string;
    type: string;
    "Estimated SP": number;
    "Actual SP": number;
  }[];
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('Todo List App');
  currentView: 'table' | 'kanban' = 'table';
  showNewTaskForm = false;
  searchTerm = '';
  selectedDeveloper = '';
  sortColumn = 'task';
  sortDirection: 'asc' | 'desc' = 'asc';
  error: string | null = null;

  developers: string[] = [];
  statuses = ['Ready to start', 'In Progress', 'Waiting for review', 'Pending Deploy', 'Done', 'Stuck'];
  priorities = ['Critical', 'High', 'Medium', 'Low', 'Best Effort'];
  types = ['Feature Enhancements', 'Other', 'Bug'];

  tasks: Task[] = [];
  filteredTasks: Task[] = [];

  newTask: Task = {
    id: 0,
    task: '',
    developer: '',
    status: 'Ready to start',
    priority: 'Medium',
    type: 'Feature Enhancements',
    date: new Date().toISOString().split('T')[0],
    estimatedSP: 0,
    actualSP: 0,
    editing: false
  };

  private draggedTask: Task | null = null;
  private readonly apiUrl = 'https://mocki.io/v1/61c56458-2b07-44e2-9ec9-c7df98ccbe9f';

  constructor(private readonly http: HttpClient, private readonly cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.error = null;

    this.http.get<ApiResponse>(this.apiUrl).subscribe({
      next: (response) => {
        if (response.response && response.data) {
          this.tasks = response.data.map((item, index) => ({
            id: index + 1,
            task: item.title,
            developer: item.developer,
            status: item.status,
            priority: item.priority,
            type: item.type,
            date: new Date().toISOString().split('T')[0],
            estimatedSP: item["Estimated SP"],
            actualSP: item["Actual SP"],
            percentage: item["Actual SP"] > 0 ? Math.round((item["Actual SP"] / item["Estimated SP"]) * 100) : 0,
            editing: false
          }));
          console.log(this.tasks);
          // Extract unique developers from the data
          this.extractDevelopers();

          this.filterTasks();
        } else {
          this.error = 'Invalid response format';
        }
      },
      error: (err) => {
        this.error = 'Failed to load tasks. Please try again.';
        console.error('Error loading tasks:', err);
      }
    });
  }

  extractDevelopers() {
    const developerSet = new Set<string>();

    this.tasks.forEach(task => {
      // Handle cases where developer field might contain multiple developers separated by comma
      const devs = task.developer.split(',').map(dev => dev.trim());
      devs.forEach(dev => developerSet.add(dev));
    });

    this.developers = Array.from(developerSet).sort((a, b) => a.localeCompare(b));
  }

  filterTasks() {
    this.filteredTasks = this.tasks.filter(task => {
      const matchesSearch = task.task.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.developer.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesDeveloper = !this.selectedDeveloper || task.developer.includes(this.selectedDeveloper);

      return matchesSearch && matchesDeveloper;
    });

    this.sortTasks();
  }

  sortTasks() {
    this.filteredTasks.sort((a, b) => {
      let aValue: any = a[this.sortColumn as keyof Task];
      let bValue: any = b[this.sortColumn as keyof Task];

      if (this.sortColumn === 'priority') {
        const priorityOrder = { 'Critical': 5, 'High': 4, 'Medium': 3, 'Low': 2, 'Best Effort': 1 };
        aValue = priorityOrder[aValue as keyof typeof priorityOrder];
        bValue = priorityOrder[bValue as keyof typeof priorityOrder];
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (this.sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }

  addTask() {
    if (this.newTask.task && this.newTask.developer.length) {
      const task: Task = {
        ...this.newTask,
        id: Math.max(...this.tasks.map(t => t.id)) + 1,
      };

      this.tasks.push(task);

      this.filterTasks();
      this.resetNewTask();
      this.showNewTaskForm = false;
    }
  }

  resetNewTask() {
    this.newTask = {
      id: 0,
      task: '',
      developer: '',
      status: 'Ready to start',
      priority: 'Medium',
      type: 'Feature Enhancements',
      date: new Date().toISOString().split('T')[0],
      estimatedSP: 0,
      actualSP: 0,
      editing: false
    };
  }

  editTask(task: Task) {
    task.editing = true;
    task.originalData = { ...task };
  }

  saveTask(task: Task) {
    task.editing = false;
    delete task.originalData;
  }


  getRowClass(task: Task): string {
    if (task.status === 'Stuck') return 'status-stuck';
    if (task.priority === 'Critical') return 'priority-critical';
    return '';
  }

  getTasksByStatus(status: string): Task[] {
    return this.filteredTasks.filter(task => task.status === status);
  }

  convertDate(date: any) {
    return moment(date).format('ddd MMM, yyyy');
  }

  onDragStart(event: DragEvent, task: Task) {
    this.draggedTask = task;
    event.dataTransfer!.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  onDrop(event: DragEvent, newStatus: string) {
    event.preventDefault();

    if (this.draggedTask && this.draggedTask.status !== newStatus) {
      this.draggedTask.status = newStatus;

      this.cdr.detectChanges();
      this.filterTasks();
    }

    this.draggedTask = null;
  }

  refreshTasks() {
    this.loadTasks();
  }
}