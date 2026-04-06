import { useNavigate, useParams } from '@tanstack/react-router';
import DOMPurify from 'dompurify';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { Spinner } from '../components/Spinner.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useToast } from '../components/Toast.js';
import { TypeIcon } from '../components/TypeIcon.js';
import {
  type Entity,
  useDeleteEntity,
  useEntity,
  useTree,
  useUpdateEntity,
} from '../lib/api.js';

const STATUSES = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export function EntityEditor() {
  const { id } = useParams({ from: '/entity/$id' });
  const { data: entity, isLoading } = useEntity(id);
  const { data: tree } = useTree();
  const updateEntity = useUpdateEntity();
  const deleteEntity = useDeleteEntity();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<Partial<Entity>>({});
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (entity) {
      setForm({
        title: entity.title,
        status: entity.status,
        priority: entity.priority,
        assignee: entity.assignee,
        owner: entity.owner,
        labels: entity.labels ?? [],
        epic_ref: entity.epic_ref,
        milestone_ref: entity.milestone_ref,
        target_date: entity.target_date,
      });
      setBody(entity.body ?? '');
    }
  }, [entity]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!entity) {
    return <p className="text-gray-500">Entity not found.</p>;
  }

  const handleSave = async () => {
    try {
      await updateEntity.mutateAsync({
        id,
        data: { ...form, body },
      });
      toast('Saved successfully', 'success');
    } catch (err) {
      toast(String(err), 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEntity.mutateAsync(id);
      toast('Deleted', 'success');
      navigate({ to: '/' });
    } catch (err) {
      toast(String(err), 'error');
    }
  };

  const addLabel = () => {
    const label = labelInput.trim();
    if (label && !(form.labels ?? []).includes(label)) {
      setForm({ ...form, labels: [...(form.labels ?? []), label] });
    }
    setLabelInput('');
  };

  const removeLabel = (label: string) => {
    setForm({
      ...form,
      labels: (form.labels ?? []).filter((l) => l !== label),
    });
  };

  const epics = tree?.epics ?? [];
  const milestones = tree?.milestones ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TypeIcon type={entity.type} className="text-xl" />
          <h2 className="text-xl font-semibold">{entity.title}</h2>
          {entity.status && <StatusBadge status={entity.status} />}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateEntity.isPending}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {updateEntity.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-6">
        {/* Left: form */}
        <div className="w-1/3 space-y-4">
          <Field label="Title">
            <input
              type="text"
              value={form.title ?? ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </Field>

          {entity.status !== undefined && (
            <Field label="Status">
              <select
                value={form.status ?? ''}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {entity.priority !== undefined && (
            <Field label="Priority">
              <select
                value={form.priority ?? ''}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {entity.type === 'story' && (
            <Field label="Assignee">
              <input
                type="text"
                value={form.assignee ?? ''}
                onChange={(e) =>
                  setForm({ ...form, assignee: e.target.value || null })
                }
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
              />
            </Field>
          )}

          {(entity.type === 'epic' || entity.type === 'prd') && (
            <Field label="Owner">
              <input
                type="text"
                value={form.owner ?? ''}
                onChange={(e) =>
                  setForm({ ...form, owner: e.target.value || null })
                }
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
              />
            </Field>
          )}

          {entity.labels !== undefined && (
            <Field label="Labels">
              <div className="flex flex-wrap gap-1 mb-1">
                {(form.labels ?? []).map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs"
                  >
                    {l}
                    <button
                      type="button"
                      onClick={() => removeLabel(l)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLabel();
                  }
                }}
                placeholder="Add label..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
              />
            </Field>
          )}

          {entity.type === 'story' && (
            <Field label="Epic">
              <select
                value={form.epic_ref?.id ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    epic_ref: e.target.value ? { id: e.target.value } : null,
                  })
                }
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="">None</option>
                {epics.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {entity.type === 'epic' && (
            <Field label="Milestone">
              <select
                value={form.milestone_ref?.id ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    milestone_ref: e.target.value
                      ? { id: e.target.value }
                      : null,
                  })
                }
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="">None</option>
                {milestones.map((ms) => (
                  <option key={ms.id} value={ms.id}>
                    {ms.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {entity.type === 'milestone' && (
            <Field label="Target Date">
              <input
                type="date"
                value={form.target_date ?? ''}
                onChange={(e) =>
                  setForm({ ...form, target_date: e.target.value || undefined })
                }
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
              />
            </Field>
          )}

          {entity.github && (
            <Field label="GitHub">
              <a
                href={`https://github.com/${entity.github.repo}/issues/${entity.github.issue_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Open in GitHub (#{entity.github.issue_number})
              </a>
            </Field>
          )}

          <div className="text-xs text-gray-400 space-y-0.5 pt-2 border-t border-gray-100">
            {entity.created_at && (
              <p>Created: {new Date(entity.created_at).toLocaleDateString()}</p>
            )}
            {entity.updated_at && (
              <p>Updated: {new Date(entity.updated_at).toLocaleDateString()}</p>
            )}
            <p className="truncate" title={entity.filePath}>
              File: {entity.filePath.split('/').slice(-2).join('/')}
            </p>
          </div>
        </div>

        {/* Right: body editor */}
        <div className="w-2/3">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={`px-2 py-1 text-xs rounded ${!preview ? 'bg-gray-200 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`px-2 py-1 text-xs rounded ${preview ? 'bg-gray-200 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Preview
            </button>
          </div>
          {preview ? (
            <div className="markdown-preview border border-gray-200 rounded p-4 min-h-[400px] bg-white text-sm">
              <MarkdownPreview text={body} />
            </div>
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full h-[400px] p-4 text-sm font-mono border border-gray-300 rounded resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Write markdown content..."
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Entity"
        message={`Are you sure you want to delete "${entity.title}"? This will remove the file from disk.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </span>
      {children}
    </div>
  );
}

export function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hulo])(.+)$/gm, '<p>$1</p>');
}

function MarkdownPreview({ text }: { text: string }) {
  const html = DOMPurify.sanitize(renderMarkdown(text));

  // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
