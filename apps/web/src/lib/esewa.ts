// Builds a hidden form and submits it — a genuine full-page browser
// navigation, not a fetch/XHR, since eSewa's own login/approval page is
// what the payer interacts with next. See docs/PHASE_7_NOTES.md
// "Slice 7a-2".
export function submitEsewaForm(actionUrl: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = actionUrl;
  form.style.display = "none";

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
