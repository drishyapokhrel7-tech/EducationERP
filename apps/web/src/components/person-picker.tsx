"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import type { StudentPicker, EmployeePicker } from "@education-erp/api-client";

// Every "pick a student / pick a staff member" dropdown in the app
// used to be a bare <select> of "Name (CODE)" <option>s — impossible
// to tell two same-named people apart, and no face to confirm against
// when money changes hands. This is the shared replacement: a
// searchable list where each row is an avatar + name + a
// "code · program · section" (or "code · designation · staff type")
// identity line.
//
// Built from plain div/button/ul, deliberately NOT @base-ui's Select
// or a second Select instance anywhere — see native-select.tsx's note
// on 1.7.0 Select.Root instances clobbering each other's value when
// several are mounted at once (every form here has 2+). The panel is
// portaled to <body> and fixed-positioned from the trigger's rect,
// because these pickers live inside <Card> (overflow-hidden) and the
// dashboard's own overflow-y-auto main scroller — an in-flow absolute
// panel gets clipped by both.

export type PersonOption = {
  id: string;
  name: string;
  code: string;
  photoUrl: string | null;
  // "Primary 5 · Section A" for a student, "Head of Department · Teaching" for staff
  detail?: string | null;
  inactive?: boolean;
};

const fullName = (p: { firstName: string; middleName: string | null; lastName: string }) =>
  [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");

export function studentToPersonOption(s: StudentPicker): PersonOption {
  return {
    id: s.id,
    name: fullName(s),
    code: s.studentCode,
    photoUrl: s.photoUrl,
    detail: [s.programName, s.sectionName].filter(Boolean).join(" · ") || null,
    inactive: s.status !== "ACTIVE",
  };
}

export function employeeToPersonOption(e: EmployeePicker): PersonOption {
  return {
    id: e.id,
    name: fullName(e),
    code: e.employeeCode,
    photoUrl: e.photoUrl,
    detail: [e.designationName, e.staffTypeName].filter(Boolean).join(" · ") || null,
    inactive: e.status !== "ACTIVE",
  };
}

type Rect = { top: number; bottom: number; left: number; width: number };

export function PersonPicker({
  options,
  value,
  onChange,
  placeholder = "Select person",
  disabled,
  clearable = true,
  className,
  id,
}: {
  options: PersonOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        (o.detail ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, bottom: r.bottom, left: r.left, width: r.width });
  }, []);

  // Keep the fixed panel glued to the trigger as any scroll container
  // (capture-phase catches the dashboard's inner scroller) or a resize
  // moves it.
  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Focus the search box on open — a DOM side-effect, not derived
  // state, so it stays an effect. Query/activeIndex are reset in
  // openPicker()/the search onChange instead (setState in an effect
  // body trips react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function openPicker() {
    setQuery("");
    setActiveIndex(0);
    measure();
    setOpen(true);
  }

  function commit(optId: string) {
    onChange(optId);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openPicker();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) commit(opt.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Flip above the trigger when there isn't ~300px of room below it.
  const flipUp = !!rect && rect.bottom + 300 > window.innerHeight && rect.top > 320;
  // Wide enough to show a full identity line without the trigger
  // itself having to be that wide; capped so it can't run off a
  // narrow viewport.
  const panelWidth = rect ? Math.min(Math.max(rect.width, 384), Math.max(280, window.innerWidth - 24)) : 384;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => (open ? setOpen(false) : openPicker())}
        onKeyDown={onKeyDown}
        className="border-input focus-visible:ring-ring/50 dark:bg-input/30 flex h-8 w-full items-center gap-2 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selected ? (
          <>
            <Avatar src={selected.photoUrl} size="sm" alt="" />
            <span className="truncate">{selected.name}</span>
            <span className="text-muted-foreground shrink-0 text-xs">{selected.code}</span>
          </>
        ) : (
          <span className="text-muted-foreground truncate">{placeholder}</span>
        )}
        <span className="text-muted-foreground ml-auto shrink-0 text-xs" aria-hidden>
          ▾
        </span>
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={panelRef}
              className="bg-popover text-popover-foreground fixed z-50 rounded-lg border shadow-md ring-1 ring-foreground/10"
              style={{
                left: Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 12)),
                width: panelWidth,
                ...(flipUp
                  ? { bottom: window.innerHeight - rect.top + 4 }
                  : { top: rect.bottom + 4 }),
              }}
            >
              <div className="border-b p-2">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Search name or code…"
                  className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none"
                />
              </div>
              <ul ref={listRef} id={listboxId} role="listbox" className="max-h-80 overflow-auto p-1">
                {clearable && value ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => commit("")}
                      className="text-muted-foreground hover:bg-accent w-full rounded-md px-2 py-1.5 text-left text-xs"
                    >
                      Clear selection
                    </button>
                  </li>
                ) : null}
                {filtered.length === 0 ? (
                  <li className="text-muted-foreground px-2 py-4 text-center text-sm">No matches</li>
                ) : (
                  filtered.map((o, idx) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={o.id === value}
                        data-idx={idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => commit(o.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
                          idx === activeIndex && "bg-accent",
                          o.id === value && "font-medium",
                        )}
                      >
                        <Avatar src={o.photoUrl} size="sm" alt="" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm">{o.name}</span>
                            {o.inactive ? (
                              <span className="text-muted-foreground shrink-0 text-[10px] uppercase">inactive</span>
                            ) : null}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {o.code}
                            {o.detail ? ` · ${o.detail}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
