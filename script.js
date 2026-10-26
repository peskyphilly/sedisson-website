const phaseData = [
  {
    title: "Assess",
    lead: "First, we work out what is actually happening.",
    body: "We look closely at the business, the market, the customer and the way new revenue is currently won. The aim is to separate the visible symptoms from the problem underneath.",
    items: ["Commercial audit", "Market research", "Product evaluation", "Competitor analysis", "Commercial readiness assessment", "Client qualification"]
  },
  {
    title: "Position",
    lead: "Buyers should quickly understand why this business is the right choice.",
    body: "We clarify who the offer is for, what makes it valuable and how it should be talked about. The result is a position the whole company can use, not a line that lives in a slide deck.",
    items: ["Positioning strategy", "Messaging guide", "Value proposition", "Offer positioning", "Objection mapping", "Founder positioning"]
  },
  {
    title: "Establish Authority",
    lead: "Before buyers respond, they check whether the promise is credible.",
    body: "We strengthen the evidence around the company and its leadership so prospects find substance when they do their homework, not just more claims.",
    items: ["Founder authority strategy", "LinkedIn optimisation", "Press distribution", "Digital footprint review", "Credibility assets", "Thought leadership planning"]
  },
  {
    title: "Activate",
    lead: "Once the groundwork is sound, we take it to market.",
    body: "We build focused outbound and demand activity around the right accounts, a relevant message and careful human judgement. Technology supports the work; it does not replace the thinking.",
    items: ["Prospect research", "AI-assisted outbound", "Personalised email", "LinkedIn outreach", "Follow-up systems", "Campaign monitoring"]
  },
  {
    title: "Optimise",
    lead: "The market will tell us what is working, if we listen properly.",
    body: "We study replies, objections, silence and conversion data, then use what we learn to improve the audience, message and way the campaign is run.",
    items: ["A/B testing", "Messaging refinement", "ICP refinement", "Objection analysis", "Campaign optimisation", "Strategic recommendations"]
  },
  {
    title: "Scale",
    lead: "Only proven work deserves to be scaled.",
    body: "Once the approach is producing consistently, we help the company pursue larger accounts, stronger partnerships and new markets without losing the discipline that made it work.",
    items: ["Enterprise account strategy", "Partnership development", "CRM optimisation", "Sales process consulting", "Quarterly planning", "International expansion"]
  }
];

const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
if (siteNav && !siteNav.querySelector('[href$="growth-systems.html"]')) {
  const growthLink = document.createElement("a");
  const nestedPage = window.location.pathname.includes("/insights/");
  growthLink.href = `${nestedPage ? "../" : ""}growth-systems.html`;
  growthLink.textContent = "Growth Systems";
  if (window.location.pathname.endsWith("growth-systems.html")) growthLink.classList.add("active");
  siteNav.prepend(growthLink);
}
menuToggle?.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!open));
  siteNav.classList.toggle("open", !open);
});
siteNav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
  siteNav.classList.remove("open");
  menuToggle?.setAttribute("aria-expanded", "false");
}));

const tabs = [...document.querySelectorAll(".method-tabs button")];
const panel = document.querySelector(".method-panel");
function showPhase(index) {
  const phase = phaseData[index];
  if (!phase || !panel) return;
  tabs.forEach((tab, i) => tab.classList.toggle("active", i === index));
  panel.animate([{ opacity: .25, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: "ease-out" });
  panel.innerHTML = `
    <p class="panel-number">${String(index + 1).padStart(2, "0")} / 06</p>
    <h3>${phase.title}</h3>
    <p class="panel-lead">${phase.lead}</p>
    <p>${phase.body}</p>
    <ul>${phase.items.map(item => `<li>${item}</li>`).join("")}</ul>`;
}
tabs.forEach((tab, index) => tab.addEventListener("click", () => showPhase(index)));

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .12 });
document.querySelectorAll(".reveal").forEach(element => observer.observe(element));

const form = document.getElementById("assessment-form");
const steps = [...document.querySelectorAll(".form-step")];
const currentStepLabel = document.getElementById("current-step");
const progressBar = document.getElementById("progress-bar");
const previousButton = document.getElementById("prev-step");
const nextButton = document.getElementById("next-step");
const submitButton = document.getElementById("submit-form");
const errorMessage = document.getElementById("form-error");
const success = document.getElementById("form-success");
const submissionReference = document.getElementById("submission-reference");
let currentStep = 0;
function createIdempotencyKey() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
let idempotencyKey = createIdempotencyKey();

function normaliseWebUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    const hostLooksPublic = url.hostname.includes(".") || /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname);
    if (!/^https?:$/.test(url.protocol) || !hostLooksPublic || url.username || url.password) return "";
    return url.href;
  } catch (_) {
    return "";
  }
}

function validateUrlField(field) {
  if (!field.matches("[data-url-field]")) return true;
  const isOptionalAndEmpty = !field.required && !field.value.trim();
  const valid = isOptionalAndEmpty || Boolean(normaliseWebUrl(field.value));
  field.setCustomValidity(valid ? "" : `Enter a valid ${field.dataset.urlField}, such as example.com.`);
  return valid;
}

function showStep(index) {
  currentStep = Math.max(0, Math.min(index, steps.length - 1));
  steps.forEach((step, i) => step.classList.toggle("active", i === currentStep));
  currentStepLabel.textContent = String(currentStep + 1);
  progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
  previousButton.style.visibility = currentStep === 0 ? "hidden" : "visible";
  nextButton.style.display = currentStep === steps.length - 1 ? "none" : "inline-flex";
  submitButton.style.display = currentStep === steps.length - 1 ? "inline-flex" : "none";
  errorMessage.textContent = "";
  saveDraft();
}

function validateStep() {
  const fields = [...steps[currentStep].querySelectorAll("input, textarea, select")];
  for (const field of fields) {
    validateUrlField(field);
    if (!field.checkValidity()) {
      field.focus();
      errorMessage.textContent = field.type === "email"
        ? "Please enter a valid business email address."
        : "Please complete the highlighted field before continuing.";
      field.reportValidity();
      return false;
    }
  }
  return true;
}

function saveDraft() {
  if (!form) return;
  const values = {};
  new FormData(form).forEach((value, key) => {
    if (values[key]) values[key] = [].concat(values[key], value);
    else values[key] = value;
  });
  try { localStorage.setItem("sedissonAssessmentDraft", JSON.stringify({ step: currentStep, values, idempotencyKey })); } catch (_) {}
}

function restoreDraft() {
  if (!form) return;
  let draft;
  try { draft = JSON.parse(localStorage.getItem("sedissonAssessmentDraft")); } catch (_) { return; }
  if (!draft?.values) return;
  if (typeof draft.idempotencyKey === "string") idempotencyKey = draft.idempotencyKey;
  Object.entries(draft.values).forEach(([name, value]) => {
    const fields = [...form.elements].filter(field => field.name === name);
    fields.forEach(field => {
      if (field.type === "checkbox" || field.type === "radio") field.checked = [].concat(value).includes(field.value);
      else field.value = Array.isArray(value) ? value[0] : value;
    });
  });
  showStep(Number.isInteger(draft.step) ? draft.step : 0);
}

nextButton?.addEventListener("click", () => { if (validateStep()) showStep(currentStep + 1); });
previousButton?.addEventListener("click", () => showStep(currentStep - 1));
form?.addEventListener("input", saveDraft);
form?.querySelectorAll("[data-url-field]").forEach(field => {
  field.addEventListener("input", () => field.setCustomValidity(""));
  field.addEventListener("blur", () => validateUrlField(field));
});
form?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!validateStep()) return;
  saveDraft();
  const originalButtonContent = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.textContent = "Storing assessment…";
  errorMessage.textContent = "";

  const payload = { idempotencyKey };
  new FormData(form).forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) payload[key] = [].concat(payload[key], value);
    else payload[key] = value;
  });

  try {
    const response = await fetch("/api/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.captured || !result.reference) {
      throw new Error(result.message || "We could not confirm that your assessment was stored.");
    }

    submissionReference.textContent = result.reference;
    form.hidden = true;
    success.hidden = false;
    try { localStorage.removeItem("sedissonAssessmentDraft"); } catch (_) {}
    success.focus();
  } catch (error) {
    errorMessage.textContent = `${error.message} Your answers are still saved in this browser; please try again.`;
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonContent;
  }
});

restoreDraft();
