
import React from 'react';
import { Task, TaskStatus, TaskPriority } from '../types';

interface TaskBoardProps {
  tasks: Task[];
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onDocumentFeature?: (task: Task) => void;
}

const TaskBoard: React.FC<TaskBoardProps> = ({ tasks, onUpdateStatus, onDocumentFeature }) => {
  const columns = [
    { id: TaskStatus.TODO, label: 'Pending' },
    { id: TaskStatus.IN_PROGRESS, label: 'In Operation' },
    { id: TaskStatus.REVIEW, label: 'Technical Review' },
    { id: TaskStatus.DONE, label: 'Completed' },
  ];

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.CRITICAL: return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case TaskPriority.HIGH: return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case TaskPriority.MEDIUM: return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getBugCountForTask = (taskId: string) => {
    return tasks.filter(t => t.category === 'BUG' && t.linkedTaskId === taskId && t.status !== TaskStatus.DONE).length;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full pb-10">
      {columns.map((col) => (
        <div key={col.id} className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">{col.label}</h3>
            <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
              {tasks.filter(t => t.status === col.id).length}
            </span>
          </div>

          <div className="flex flex-col gap-4 min-h-[200px]">
            {tasks.filter(t => t.status === col.id).map((task) => {
              const isBug = task.category === 'BUG';
              const bugCount = getBugCountForTask(task.id);

              return (
                <div
                  key={task.id}
                  className={`bg-slate-900 border ${isBug ? 'border-rose-500/20' : 'border-slate-800'} p-4 rounded-xl shadow-sm hover:border-slate-700 transition-colors group flex flex-col relative`}
                >
                  {/* Bug Alert Indicator */}
                  {!isBug && bugCount > 0 && (
                    <div className="absolute -top-1 -right-1 flex items-center justify-center">
                      <div className="w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(225,29,72,0.6)] animate-pulse">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <span className="ml-1 text-[9px] font-black text-rose-500 uppercase">{bugCount}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-tight ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      {isBug && (
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">BUG</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600 font-mono">#{task.id.split('-').slice(-1)}</span>
                  </div>

                  <h4 className="text-sm font-semibold text-white mb-1 group-hover:text-indigo-400 transition-colors">{task.title}</h4>
                  <p className="text-xs text-slate-400 mb-4 line-clamp-2">{task.description}</p>

                  {isBug && (
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[9px] font-mono text-teal-500">
                          {task.module || 'GENERIC'}
                        </div>
                        <div className="text-[9px] text-slate-600 font-black uppercase">
                          via {task.reporter || 'AUTO'}
                        </div>
                      </div>
                      {task.linkedTaskId && (
                        <div className="text-[8px] font-mono text-slate-700 uppercase tracking-widest">
                          SRC_ID: #{task.linkedTaskId.split('-').slice(-1)}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400" title={task.assignee}>
                        {task.assignee.charAt(0).toUpperCase()}
                      </div>
                      {task.status === TaskStatus.DONE && onDocumentFeature && (
                        <button
                          onClick={() => onDocumentFeature(task)}
                          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-400/10 px-2 py-1 rounded-lg border border-emerald-400/20 transition-all"
                          title="Draft technical spec from this completed task"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          SPEC
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {col.id !== TaskStatus.TODO && (
                        <button
                          onClick={() => {
                            const statusOrder = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.DONE];
                            const currentIndex = statusOrder.indexOf(col.id);
                            onUpdateStatus(task.id, statusOrder[currentIndex - 1]);
                          }}
                          className="text-[10px] text-slate-500 hover:text-white transition-colors"
                        >
                          BACK
                        </button>
                      )}
                      {col.id !== TaskStatus.DONE && (
                        <button
                          onClick={() => {
                            const statusOrder = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.DONE];
                            const currentIndex = statusOrder.indexOf(col.id);
                            onUpdateStatus(task.id, statusOrder[currentIndex + 1]);
                          }}
                          className="text-[10px] text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                        >
                          NEXT
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {tasks.filter(t => t.status === col.id).length === 0 && (
              <div className="flex items-center justify-center border-2 border-dashed border-slate-800/50 rounded-2xl h-32">
                <p className="text-xs text-slate-600 italic">Sector Clear</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TaskBoard;
