'use client';

import * as React from 'react';
import { FileWarning, Pencil, Send } from 'lucide-react';
import type { Complaint } from '@/types/complaint';
import type { ChatAction } from '@/types/chat';
import { Badge, Button, Card, CardBody, Field, Input, Textarea } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { SourceLine } from './service-cards';

/**
 * The complaint draft. Nothing is sent until the citizen presses send, and the
 * text stays fully editable until then.
 */
export function ComplaintDraftCard({
  complaint,
  onAction,
  busy,
}: {
  complaint: Complaint;
  onAction?: (action: ChatAction) => void;
  busy?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [subject, setSubject] = React.useState(complaint.subject);
  const [description, setDescription] = React.useState(complaint.description);
  const isDraft = complaint.status === 'draft';

  React.useEffect(() => {
    setSubject(complaint.subject);
    setDescription(complaint.description);
  }, [complaint.subject, complaint.description]);

  function save() {
    onAction?.({
      kind: 'action',
      label: 'Save changes',
      action: 'UPDATE_COMPLAINT',
      payload: { complaintId: complaint.id, subject, description },
    });
    setEditing(false);
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <FileWarning className="size-4 text-ink-subtle" aria-hidden="true" />
            Your complaint
          </h3>
          <Badge tone={isDraft ? 'wait' : 'ok'}>{isDraft ? 'Not sent yet' : 'Sent'}</Badge>
        </div>

        <dl className="space-y-2 rounded-lg border border-line p-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">Goes to</dt>
            <dd className="text-sm text-ink-muted">
              {complaint.department}
              {complaint.departmentEmail ? (
                <span className="block text-xs text-ink-subtle">{complaint.departmentEmail}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">Subject</dt>
            <dd className="text-sm font-medium text-ink">{complaint.subject}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">Description</dt>
            <dd className="whitespace-pre-line text-sm text-ink-muted">{complaint.description}</dd>
          </div>
          {complaint.reference ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-subtle">Your complaint number</dt>
              <dd className="text-sm font-medium text-ink">{complaint.reference}</dd>
            </div>
          ) : null}
        </dl>

        {isDraft ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
            <Button
              onClick={() =>
                onAction?.({
                  kind: 'action',
                  label: 'Send complaint',
                  action: 'SEND_COMPLAINT',
                  payload: { taskId: complaint.taskId },
                })
              }
              disabled={busy || !onAction}
            >
              <Send className="size-4" aria-hidden="true" />
              Send complaint
            </Button>
          </div>
        ) : null}

        <SourceLine
          source={{
            name: complaint.officialSourceName,
            url: complaint.officialSourceUrl,
            dataType: 'verified_public_information',
          }}
        />
        <p className="text-xs text-ink-subtle">
          This is a practice app. To raise a real complaint, use the official service linked above.
        </p>
      </CardBody>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Change your complaint"
        description="Change anything that is not right. It is your complaint, in your words."
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={subject.trim().length < 3 || description.trim().length < 10}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Subject" htmlFor="complaint-subject">
            <Input
              id="complaint-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={200}
            />
          </Field>
          <Field
            label="Description"
            htmlFor="complaint-description"
            hint="Say what happened and what you would like the department to do."
          >
            <Textarea
              id="complaint-description"
              rows={10}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={4000}
            />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
