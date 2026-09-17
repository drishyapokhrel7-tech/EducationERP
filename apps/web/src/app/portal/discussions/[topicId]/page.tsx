"use client";

import { use, useState, type FormEvent } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { submitAction } from "@/lib/submit-action";

export default function PortalDiscussionTopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = use(params);
  const topic = useSWR(["portal-discussion-topic", topicId], () => api.getStudentDiscussionTopic(topicId));
  const [replyBody, setReplyBody] = useState("");

  return (
    <div className="max-w-2xl space-y-6">
      {!topic.data ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold">{topic.data.title}</h1>
          </div>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm whitespace-pre-wrap">{topic.data.body}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Replies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topic.data.posts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No replies yet — be the first.</p>
              ) : (
                <ul className="space-y-3">
                  {topic.data.posts.map((p) => (
                    <li key={p.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">
                        {p.authorEmployee
                          ? `${p.authorEmployee.firstName} ${p.authorEmployee.lastName} (Teacher)`
                          : p.authorStudent
                            ? `${p.authorStudent.firstName} ${p.authorStudent.lastName}`
                            : "Unknown"}
                      </p>
                      <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{p.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              <form
                className="space-y-2"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () => api.createStudentDiscussionPost(topicId, { body: replyBody }),
                    () => {
                      setReplyBody("");
                      topic.mutate();
                    },
                    "Reply posted",
                    "Posting…",
                  );
                }}
              >
                <textarea
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3"
                  placeholder="Write a reply…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <Button type="submit" disabled={!replyBody}>
                  Reply
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
