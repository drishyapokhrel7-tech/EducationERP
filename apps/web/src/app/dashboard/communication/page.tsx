"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { submitAction, submitDelete, errorMessage } from "@/lib/submit-action";
import type { MessageAudience, MessageChannel } from "@education-erp/api-client";

const CHANNELS: { value: MessageChannel; label: string }[] = [
  { value: "IN_APP", label: "In-app" },
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "PUSH", label: "Push" },
];

const AUDIENCES: { value: MessageAudience; label: string }[] = [
  { value: "ALL_STAFF", label: "All staff" },
  { value: "ALL_STUDENTS", label: "All students" },
  { value: "ALL_GUARDIANS", label: "All guardians" },
  { value: "SPECIFIC_USER", label: "Specific user" },
];

// Displayed values (badges, picker labels) previously showed the raw
// enum — "IN_APP", "ALL_GUARDIANS" — even though CHANNELS/AUDIENCES
// above already had the human labels for the form dropdowns; these
// just look them back up for anywhere a value is rendered, not chosen.
function channelLabel(value: MessageChannel): string {
  return CHANNELS.find((c) => c.value === value)?.label ?? value;
}
function audienceLabel(value: MessageAudience): string {
  return AUDIENCES.find((a) => a.value === value)?.label ?? value;
}

export default function CommunicationPage() {
  const templates = useSWR("message-templates", () => api.listMessageTemplates());
  const messages = useSWR("messages", () => api.listMessages());
  // Real blast-radius confirm for Send — fetches the actual resolved
  // recipient count before the message actually goes out.
  const [sendPreview, setSendPreview] = useState<{ messageId: string; recipientCount: number; unresolvable: boolean } | null>(
    null,
  );
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // recipient" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const users = useSWR("users-for-messaging", () => api.listEmployeesPicker());

  const [templateForm, setTemplateForm] = useState<{ name: string; channel: MessageChannel; subject: string; body: string }>({
    name: "",
    channel: "EMAIL",
    subject: "",
    body: "",
  });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateForm, setEditTemplateForm] = useState<{
    name: string;
    channel: MessageChannel;
    subject: string;
    body: string;
  }>({ name: "", channel: "EMAIL", subject: "", body: "" });

  const [messageForm, setMessageForm] = useState<{
    channel: MessageChannel;
    audience: MessageAudience;
    recipientUserId: string;
    templateId: string;
    subject: string;
    body: string;
  }>({ channel: "EMAIL", audience: "ALL_STAFF", recipientUserId: "", templateId: "", subject: "", body: "" });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Communication</h1>
        <p className="text-muted-foreground text-sm">
          Org-wide broadcast messaging across in-app, email, SMS, and push. Course announcements live under Academics/
          Syllabus; this is for admin-composed messages to staff, students, or guardians. Email delivers for real
          once your organization&apos;s email is configured; SMS and push are simulated only until a provider is set up.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!templates.data || templates.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No templates yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {templates.data.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{t.name}</span> <Badge variant="secondary">{channelLabel(t.channel)}</Badge>
                    {t.subject ? <span className="text-muted-foreground"> — {t.subject}</span> : null}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingTemplateId(t.id);
                        setEditTemplateForm({
                          name: t.name,
                          channel: t.channel,
                          subject: t.subject ?? "",
                          body: t.body,
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => submitDelete(() => api.deleteMessageTemplate(t.id), () => templates.mutate())}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editingTemplateId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateMessageTemplate(editingTemplateId, {
                      name: editTemplateForm.name,
                      channel: editTemplateForm.channel,
                      subject: editTemplateForm.subject || undefined,
                      body: editTemplateForm.body,
                    }),
                  () => {
                    setEditingTemplateId(null);
                    templates.mutate();
                  },
                );
              }}
            >
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  className="w-40"
                  value={editTemplateForm.name}
                  onChange={(e) => setEditTemplateForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Channel</Label>
                <NativeSelect
                  className="w-32"
                  placeholder="Channel"
                  value={editTemplateForm.channel}
                  onChange={(v) => setEditTemplateForm((f) => ({ ...f, channel: v as MessageChannel }))}
                  options={CHANNELS}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subject (optional)</Label>
                <Input
                  className="w-48"
                  value={editTemplateForm.subject}
                  onChange={(e) => setEditTemplateForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body</Label>
                <Textarea
                  className="w-64"
                  value={editTemplateForm.body}
                  onChange={(e) => setEditTemplateForm((f) => ({ ...f, body: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm" disabled={!editTemplateForm.name || !editTemplateForm.body}>
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingTemplateId(null)}>
                Cancel
              </Button>
            </form>
          ) : null}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createMessageTemplate({
                    name: templateForm.name,
                    channel: templateForm.channel,
                    subject: templateForm.subject || undefined,
                    body: templateForm.body,
                  }),
                () => {
                  setTemplateForm({ name: "", channel: "EMAIL", subject: "", body: "" });
                  templates.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                className="w-40"
                value={templateForm.name}
                onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Channel</Label>
              <NativeSelect
                className="w-32"
                placeholder="Channel"
                value={templateForm.channel}
                onChange={(v) => setTemplateForm((f) => ({ ...f, channel: v as MessageChannel }))}
                options={CHANNELS}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject (optional)</Label>
              <Input
                className="w-48"
                value={templateForm.subject}
                onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Textarea
                className="w-64"
                value={templateForm.body}
                onChange={(e) => setTemplateForm((f) => ({ ...f, body: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!templateForm.name || !templateForm.body}>
              Add template
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!messages.data || messages.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No messages yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {messages.data.map((m) => (
                <li key={m.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <Badge variant="secondary">{channelLabel(m.channel)}</Badge> <Badge variant="outline">{audienceLabel(m.audience)}</Badge>{" "}
                      {m.subject ? <span className="font-medium">{m.subject}</span> : <span className="text-muted-foreground">(no subject)</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                      {m.status === "DRAFT" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            api
                              .previewMessageRecipients(m.id)
                              .then((preview) => setSendPreview({ messageId: m.id, ...preview }))
                              .catch((err) => toast.error(errorMessage(err, "Could not compute recipients")))
                          }
                        >
                          Send
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">{m.body}</p>
                  {m.status === "SENT" ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Delivered: {m.emailLogs.length} email, {m.smsLogs.length} SMS, {m.pushLogs.length} push
                      {m.channel === "IN_APP" ? ", in-app notifications created" : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createMessage({
                    channel: messageForm.channel,
                    audience: messageForm.audience,
                    recipientUserId: messageForm.audience === "SPECIFIC_USER" ? messageForm.recipientUserId || undefined : undefined,
                    templateId: messageForm.templateId || undefined,
                    subject: messageForm.subject || undefined,
                    body: messageForm.body || undefined,
                  }),
                () => {
                  setMessageForm({ channel: "EMAIL", audience: "ALL_STAFF", recipientUserId: "", templateId: "", subject: "", body: "" });
                  messages.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Channel</Label>
              <NativeSelect
                className="w-32"
                placeholder="Channel"
                value={messageForm.channel}
                onChange={(v) => setMessageForm((f) => ({ ...f, channel: v as MessageChannel }))}
                options={CHANNELS}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Audience</Label>
              <NativeSelect
                className="w-36"
                placeholder="Audience"
                value={messageForm.audience}
                onChange={(v) => setMessageForm((f) => ({ ...f, audience: v as MessageAudience }))}
                options={AUDIENCES}
              />
            </div>
            {messageForm.audience === "SPECIFIC_USER" ? (
              <div className="space-y-1">
                <Label className="text-xs">Recipient (staff)</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select employee"
                  value={messageForm.recipientUserId}
                  onChange={(v) => setMessageForm((f) => ({ ...f, recipientUserId: v }))}
                  options={(users.data ?? [])
                    .filter((u) => !!u.userId)
                    .map((u) => ({ value: u.userId as string, label: `${u.firstName} ${u.lastName}` }))}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs">Template (optional)</Label>
              <NativeSelect
                className="w-40"
                placeholder="Use a template"
                value={messageForm.templateId}
                onChange={(v) => {
                  const t = templates.data?.find((tpl) => tpl.id === v);
                  setMessageForm((f) => ({
                    ...f,
                    templateId: v,
                    channel: t?.channel ?? f.channel,
                    subject: t?.subject ?? f.subject,
                    body: t?.body ?? f.body,
                  }));
                }}
                options={(templates.data ?? []).map((t) => ({ value: t.id, label: `${t.name} (${channelLabel(t.channel)})` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject (optional)</Label>
              <Input
                className="w-48"
                value={messageForm.subject}
                onChange={(e) => setMessageForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Textarea className="w-64" value={messageForm.body} onChange={(e) => setMessageForm((f) => ({ ...f, body: e.target.value }))} />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!messageForm.body && !messageForm.templateId}
            >
              Compose (draft)
            </Button>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={sendPreview !== null}
        onOpenChange={(open) => !open && setSendPreview(null)}
        title="Send this message?"
        description={
          sendPreview
            ? sendPreview.unresolvable
              ? "This audience has no contact path for this channel — sending will fail. Pick a different channel or audience instead."
              : sendPreview.recipientCount === 0
                ? "No recipients currently resolve for this audience — nothing will actually be sent."
                : `This sends to ${sendPreview.recipientCount} recipient(s) immediately. There is no way to recall a message once sent.`
            : ""
        }
        confirmLabel="Send"
        onConfirm={() => {
          if (!sendPreview) return;
          return submitAction(() => api.sendMessage(sendPreview.messageId), () => messages.mutate());
        }}
      />
    </div>
  );
}
