"use client";

import { use } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

export default function PortalCourseModulesPage({
  params,
}: {
  params: Promise<{ teachingAssignmentId: string }>;
}) {
  const { teachingAssignmentId } = use(params);
  const modules = useSWR(["portal-modules", teachingAssignmentId], () => api.listStudentModules(teachingAssignmentId));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Modules</h1>
        <p className="text-muted-foreground text-sm">Course content, organized by your teacher into modules.</p>
      </div>

      {!modules.data ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : modules.data.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">No modules have been published for this course yet.</p>
          </CardContent>
        </Card>
      ) : (
        modules.data.map((m) => {
          const total = m.items.length;
          const done = m.items.filter((i) => i.completed).length;
          return (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>
                    {m.sequence}. {m.title}
                  </span>
                  {total > 0 ? (
                    <Badge variant={done === total ? "success" : "secondary"}>
                      {done}/{total} complete
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {m.description ? <p className="text-muted-foreground text-sm">{m.description}</p> : null}
                {m.items.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No content in this module yet.</p>
                ) : (
                  <ul className="divide-y">
                    {m.items.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                        <div className="space-y-1">
                          <p className="font-medium">
                            {item.sequence}. {item.title} <span className="text-muted-foreground">({item.type})</span>
                          </p>
                          {item.type === "PAGE" ? (
                            <p className="text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                          ) : (
                            <a
                              href={item.content}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline underline-offset-4"
                            >
                              Open {item.type.toLowerCase()}
                            </a>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={item.completed ? "outline" : "default"}
                          disabled={item.completed}
                          onClick={async () => {
                            try {
                              await api.completeModuleItem(item.id);
                              modules.mutate();
                            } catch (err) {
                              toast.error(errorMessage(err, "Failed to mark complete"));
                            }
                          }}
                        >
                          {item.completed ? (
                            <>
                              <CheckCircle2 className="size-4" /> Done
                            </>
                          ) : (
                            <>
                              <Circle className="size-4" /> Mark complete
                            </>
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
