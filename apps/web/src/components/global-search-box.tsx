"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { SearchResult } from "@education-erp/api-client";

const DEBOUNCE_MS = 300;

const EMPTY_RESULT: SearchResult = {
  students: [],
  employees: [],
  guardians: [],
  vehicles: [],
  inventoryItems: [],
  exams: [],
};

// Phase 8 "global search" bullet. Part 1 covered people (students,
// staff, guardians); part 2 added Vehicles, Inventory items, and
// Exams — the next tier of "look this up by name/code" targets, each
// with a clear identifying field. Admin /dashboard only; same
// click-outside dismissal pattern as NotificationBell. Results link
// to their entity's existing list page with a `highlight` query param
// — there is no per-record detail route in this app yet, so "jump to
// and scroll to the right row" is the honest, buildable destination
// (see the `highlight` handling added to each destination page).
export function GlobalSearchBox() {
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult>(EMPTY_RESULT);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Every state update this effect makes happens inside the debounce
  // timer's callback, never synchronously in the effect body itself —
  // including the "query too short, reset" case, which could
  // otherwise fire immediately. React's own cleanup (returned below)
  // cancels the previous timer on every keystroke, so this is still a
  // proper debounce, not a behavior change.
  useEffect(() => {
    const term = query.trim();
    const timer = setTimeout(async () => {
      if (term.length < 2) {
        setResult(EMPTY_RESULT);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await api.globalSearch(term);
        setResult(data);
      } catch {
        setResult(EMPTY_RESULT);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const hasResults =
    result.students.length > 0 ||
    result.employees.length > 0 ||
    result.guardians.length > 0 ||
    result.vehicles.length > 0 ||
    result.inventoryItems.length > 0 ||
    result.exams.length > 0;
  const showDropdown = open && query.trim().length >= 2;

  // A full navigation, not next/navigation's router.push — a soft
  // client-side navigation to a route that's already mounted (e.g.
  // searching again while already on /dashboard/students) never
  // remounts the page, so useHighlightFromSearch's effect (gated on
  // its data-loaded `ready` flag, which would already be true) never
  // re-fires and the highlight silently does nothing. A full
  // navigation always re-mounts from scratch and also guarantees
  // fresh data, at the cost of the SPA-style instant transition —
  // the right trade for a "jump to a specific record" utility.
  function goTo(path: string, id: string) {
    setOpen(false);
    setQuery("");
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full navigation, see comment above
    window.location.href = `${path}?highlight=${id}`;
  }

  return (
    <div className="relative w-64" ref={containerRef}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        className="pl-8"
        placeholder="Search students, staff, vehicles, items, exams…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {showDropdown ? (
        <div className="bg-popover ring-foreground/10 absolute left-0 z-50 mt-2 w-96 rounded-lg p-2 shadow-md ring-1">
          {loading ? (
            <p className="text-muted-foreground p-2 text-sm">Searching…</p>
          ) : !hasResults ? (
            <p className="text-muted-foreground p-2 text-sm">No matches.</p>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {result.students.length > 0 ? (
                <div>
                  <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase">Students</p>
                  <ul>
                    {result.students.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                          onClick={() => goTo("/dashboard/students", `student-${s.id}`)}
                        >
                          {s.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- external/storage-backend URL
                            <img src={s.photoUrl} alt="" className="bg-muted size-6 rounded-full border object-cover" />
                          ) : null}
                          <span>
                            {s.firstName} {s.lastName} <span className="text-muted-foreground">{s.studentCode}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.employees.length > 0 ? (
                <div>
                  <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase">Staff</p>
                  <ul>
                    {result.employees.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                          onClick={() => goTo("/dashboard/staff", `employee-${e.id}`)}
                        >
                          {e.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- external/storage-backend URL
                            <img src={e.photoUrl} alt="" className="bg-muted size-6 rounded-full border object-cover" />
                          ) : null}
                          <span>
                            {e.firstName} {e.lastName} <span className="text-muted-foreground">{e.employeeCode}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.guardians.length > 0 ? (
                <div>
                  <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase">Guardians</p>
                  <ul>
                    {result.guardians.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                          onClick={() => goTo("/dashboard/students", `guardian-${g.id}`)}
                        >
                          <span>
                            {g.firstName} {g.lastName} <span className="text-muted-foreground">{g.phone}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.vehicles.length > 0 ? (
                <div>
                  <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase">Vehicles</p>
                  <ul>
                    {result.vehicles.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                          onClick={() => goTo("/dashboard/transport", `vehicle-${v.id}`)}
                        >
                          <span>
                            {v.registrationNumber} <span className="text-muted-foreground">{v.type}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.inventoryItems.length > 0 ? (
                <div>
                  <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase">Inventory items</p>
                  <ul>
                    {result.inventoryItems.map((i) => (
                      <li key={i.id}>
                        <button
                          type="button"
                          className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                          onClick={() => goTo("/dashboard/inventory", `inventory-item-${i.id}`)}
                        >
                          <span>
                            {i.name} <span className="text-muted-foreground">{i.sku}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.exams.length > 0 ? (
                <div>
                  <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase">Exams</p>
                  <ul>
                    {result.exams.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                          onClick={() => goTo("/dashboard/exams", `exam-${e.id}`)}
                        >
                          {e.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
