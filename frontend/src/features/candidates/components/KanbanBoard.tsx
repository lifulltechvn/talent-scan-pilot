import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { cn } from '@/shared/utils/cn';
import { Badge } from '@/shared/components/ui/Badge';
import { ScoreBar } from '@/shared/components/ui/ScoreBar';
import { useUpdateCandidateStatus } from '../hooks/useCandidates';
import { useI18n } from '@/shared/i18n';
import type { Candidate, CandidateStatus } from '@/domain/models/candidate';
import { Inbox, Eye, CheckCircle2, XCircle, DatabaseZap, GripVertical } from 'lucide-react';

const COLUMNS: { id: CandidateStatus; labelKey: 'statusNew' | 'statusReviewed' | 'statusApproved' | 'statusRejected' | 'statusTalentPool'; icon: typeof Inbox; color: string }[] = [
  { id: 'new', labelKey: 'statusNew', icon: Inbox, color: 'border-t-blue-400' },
  { id: 'reviewed', labelKey: 'statusReviewed', icon: Eye, color: 'border-t-amber-400' },
  { id: 'approved', labelKey: 'statusApproved', icon: CheckCircle2, color: 'border-t-emerald-400' },
  { id: 'rejected', labelKey: 'statusRejected', icon: XCircle, color: 'border-t-red-400' },
];

function Column({ id, label, icon: Icon, color, count, isOver, children }: {
  id: string; label: string; icon: typeof Inbox; color: string; count: number; isOver: boolean; children: React.ReactNode;
}) {
  return (
    <div className={cn(
      'flex flex-col min-w-[220px] w-[220px] bg-bg-surface/50 rounded-xl border border-border-subtle border-t-[3px] transition-colors',
      color, isOver && 'bg-accent/5 border-accent/30'
    )}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle">
        <Icon size={14} className="text-text-muted" />
        <span className="text-[12px] font-semibold text-text-primary">{label}</span>
        <span className="ml-auto text-[10px] bg-bg-panel text-text-muted px-1.5 py-0.5 rounded-full font-medium">{count}</span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-240px)]">
        {children}
      </div>
    </div>
  );
}

function DroppableColumn(props: { id: CandidateStatus; label: string; icon: typeof Inbox; color: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: props.id });
  return (
    <div ref={setNodeRef}>
      <Column {...props} isOver={isOver} />
    </div>
  );
}

function CandidateCard({ candidate, isDragging }: { candidate: Candidate; isDragging?: boolean }) {
  return (
    <div className={cn(
      'bg-bg-panel border border-border-subtle rounded-lg p-2.5 transition-shadow',
      isDragging ? 'shadow-lg rotate-2 scale-105' : 'hover:shadow-sm hover:border-accent/20'
    )}>
      <div className="flex items-start gap-2">
        <GripVertical size={12} className="text-text-muted mt-0.5 shrink-0 opacity-40" />
        <div className="min-w-0 flex-1">
          <Link to={`/candidates/${candidate.id}`} className="text-[12px] font-medium text-accent hover:underline truncate block"
            onClick={e => isDragging && e.preventDefault()}>
            {candidate.structuredData.name}
          </Link>
          <div className="text-[10px] text-text-muted mt-0.5">{candidate.structuredData.totalYearsExperience}y exp</div>
        </div>
        <Badge variant={candidate.score?.classification ?? 'neutral'}>{candidate.score?.classification ?? '—'}</Badge>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {candidate.structuredData.skills.slice(0, 3).map(s => (
          <span key={s} className="text-[9px] bg-bg-surface text-text-secondary px-1.5 py-0.5 rounded">{s}</span>
        ))}
        {candidate.structuredData.skills.length > 3 && (
          <span className="text-[9px] text-text-muted">+{candidate.structuredData.skills.length - 3}</span>
        )}
      </div>
      <div className="mt-2"><ScoreBar score={candidate.score?.finalScore ?? 0} /></div>
    </div>
  );
}

function DraggableCard({ candidate }: { candidate: Candidate }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: candidate.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn('cursor-grab active:cursor-grabbing', isDragging && 'opacity-30')}>
      <CandidateCard candidate={candidate} />
    </div>
  );
}

export function KanbanBoard({ candidates }: { candidates: Candidate[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const updateStatus = useUpdateCandidateStatus();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { t } = useI18n();

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = candidates.filter(c => c.status === col.id);
    return acc;
  }, {} as Record<CandidateStatus, Candidate[]>);

  const activeCandidate = activeId ? candidates.find(c => c.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) { setActiveId(event.active.id as string); }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const candidateId = active.id as string;
    const newStatus = over.id as CandidateStatus;
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate && candidate.status !== newStatus) {
      updateStatus.mutate({ id: candidateId, status: newStatus });
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <DroppableColumn key={col.id} id={col.id} label={t(col.labelKey)} icon={col.icon} color={col.color} count={grouped[col.id].length}>
            {grouped[col.id].map(c => <DraggableCard key={c.id} candidate={c} />)}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay>{activeCandidate && <CandidateCard candidate={activeCandidate} isDragging />}</DragOverlay>
    </DndContext>
  );
}
