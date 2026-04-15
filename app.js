const DEFAULT_STAFF_PSEUDO = String.fromCharCode(67, 111, 111, 107, 105, 101, 48, 50, 46);
const SESSION_KEY = "web_sender_current_user";
const RAW_CONFIG = window.WEB_SENDER_CONFIG || {};

const SUPABASE_URL = String(RAW_CONFIG.supabaseUrl || "").trim();
const SUPABASE_ANON_KEY = String(RAW_CONFIG.supabaseAnonKey || "").trim();
const STORAGE_BUCKET = String(RAW_CONFIG.bucket || "photos").trim() || "photos";
const STAFF_PSEUDO = String(RAW_CONFIG.staffPseudo || DEFAULT_STAFF_PSEUDO);
const STORAGE_QUOTA_BYTES = Number(RAW_CONFIG.storageQuotaBytes) > 0 ? Number(RAW_CONFIG.storageQuotaBytes) : 2147483648;

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
const uploadPanel = document.getElementById("uploadPanel");
const photoInput = document.getElementById("photoInput");
const staffConsent = document.getElementById("staffConsent");
const uploadLockedNotice = document.getElementById("uploadLockedNotice");
const statusBox = document.getElementById("statusBox");
const communityLock = document.getElementById("communityLock");
const communityLockNotice = document.getElementById("communityLockNotice");
const communityAccess = document.getElementById("communityAccess");
const toggleCommunity = document.getElementById("toggleCommunity");
const communityBlock = document.getElementById("communityBlock");
const communityGallery = document.getElementById("communityGallery");
const communityNotice = document.getElementById("communityNotice");
const communityTimer = document.getElementById("communityTimer");
const videosAccess = document.getElementById("videosAccess");
const videosNotice = document.getElementById("videosNotice");
const toggleVideos = document.getElementById("toggleVideos");
const videosBlock = document.getElementById("videosBlock");
const videosFeed = document.getElementById("videosFeed");
const refreshVideos = document.getElementById("refreshVideos");
const videoModal = document.getElementById("videoModal");
const videoModalPlayer = document.getElementById("videoModalPlayer");
const videoModalTitle = document.getElementById("videoModalTitle");
const videoModalInfo = document.getElementById("videoModalInfo");
const videoUploadPanel = document.getElementById("videoUploadPanel");
const videoUploadForm = document.getElementById("videoUploadForm");
const videoUploadTitle = document.getElementById("videoUploadTitle");
const videoUploadFile = document.getElementById("videoUploadFile");
const videoUploadNotice = document.getElementById("videoUploadNotice");

const staffList = document.getElementById("staffList");
const disconnectUser = document.getElementById("disconnectUser");
const disconnectStaff = document.getElementById("disconnectStaff");
const staffInsights = document.getElementById("staffInsights");
const staffVideoForm = document.getElementById("staffVideoForm");
const staffVideoTitle = document.getElementById("staffVideoTitle");
const staffVideoFile = document.getElementById("staffVideoFile");
const staffVideoNotice = document.getElementById("staffVideoNotice");
const refreshStaffVideos = document.getElementById("refreshStaffVideos");
const staffVideosList = document.getElementById("staffVideosList");
const floatingField = document.querySelector(".floating-folders");
const statusFilter = document.getElementById("statusFilter");
const searchStaff = document.getElementById("searchStaff");
const refreshStaff = document.getElementById("refreshStaff");
const staffStats = document.getElementById("staffStats");
const staffTabs = document.querySelectorAll("[data-staff-tab]");
const staffPanels = document.querySelectorAll("[data-staff-panel]");

const STATUS_OPTIONS = ["en attente", "accepté", "refusé"];
const STATUS_LABELS = {
  "en attente": "En attente",
  accepté: "Accepté",
  refusé: "Refusé"
};
const VIDEO_STATUS_OPTIONS = ["en attente", "publiée", "refusée"];
const VIDEO_STATUS_LABELS = {
  "en attente": "En attente",
  "publiée": "Publiée",
  refusée: "Refusée"
};

let staffCache = [];
let schemaSupportsStaffFields = true;
let schemaSupportsStorageStats = true;
let schemaSupportsPublicStatus = true;
let schemaSupportsCommunityComments = true;
let schemaSupportsCommunityLikes = true;
let schemaSupportsPresence = true;
let schemaSupportsStaffVideos = true;
let schemaSupportsVideoMetadata = true;

let currentPseudo = null;
let currentSubmissionApproved = false;
let currentTemporaryAccessActive = false;
let communityIsOpen = false;
let videosIsOpen = false;
let staffVideosCache = [];
let currentStaffPanel = "overview";
let currentVideoModalUrl = "";
let communityAccessCountdownId = null;
let communityAccessExpiryTimeoutId = null;
let presenceHeartbeatId = null;
let currentPresenceSection = "login";

const TEMP_ACCESS_DURATION_MS = 10 * 60 * 1000;
const TEMP_ACCESS_KEY_PREFIX = "web_sender_temp_access_until:";
const TEMPORARY_ACCESS_SECTION = "community";
const PRESENCE_PULSE_MS = 30 * 1000;

function setStatus(message, type) {
  statusBox.innerHTML = "";
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
  statusBox.classList.remove("hidden");
}

function getTemporaryAccessKey(pseudo) {
  return `${TEMP_ACCESS_KEY_PREFIX}${String(pseudo || "").trim().toLowerCase()}`;
}

function getTemporaryAccessExpiry(pseudo) {
  const rawValue = localStorage.getItem(getTemporaryAccessKey(pseudo));
  const expiry = Number(rawValue);
  return Number.isFinite(expiry) ? expiry : 0;
}

function setTemporaryAccessExpiry(pseudo, expiry) {
  localStorage.setItem(getTemporaryAccessKey(pseudo), String(expiry));
}

function clearTemporaryAccessExpiry(pseudo) {
  localStorage.removeItem(getTemporaryAccessKey(pseudo));
}

function formatRemainingTime(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function clearCommunityTimers() {
  if (communityAccessCountdownId) {
    window.clearInterval(communityAccessCountdownId);
    communityAccessCountdownId = null;
  }
  if (communityAccessExpiryTimeoutId) {
    window.clearTimeout(communityAccessExpiryTimeoutId);
    communityAccessExpiryTimeoutId = null;
  }
}

function clearPresenceHeartbeat() {
  if (presenceHeartbeatId) {
    window.clearInterval(presenceHeartbeatId);
    presenceHeartbeatId = null;
  }
}

function isStaffPseudo() {
  return String(currentPseudo || "").trim() === String(STAFF_PSEUDO || "").trim();
}

async function updatePresence(section = currentPresenceSection) {
  if (!supabaseClient || !currentPseudo || !schemaSupportsPresence) {
    return;
  }

  const payload = {
    pseudo: currentPseudo,
    current_section: section,
    last_seen_at: new Date().toISOString()
  };

  const tempExpiry = getTemporaryAccessExpiry(currentPseudo);
  if (tempExpiry > Date.now()) {
    payload.temp_access_until = new Date(tempExpiry).toISOString();
  }

  const { error } = await supabaseClient.from("site_presence").upsert([payload], { onConflict: "pseudo" });
  if (error) {
    const message = String(error.message || "");
    if (/site_presence/i.test(message) && /does not exist/i.test(message)) {
      schemaSupportsPresence = false;
      return;
    }
    throw new Error(message || "Mise a jour de presence impossible");
  }
}

function startPresenceHeartbeat(section = currentPresenceSection) {
  currentPresenceSection = section;
  clearPresenceHeartbeat();

  if (!supabaseClient || !currentPseudo || !schemaSupportsPresence) {
    return;
  }

  updatePresence(section).catch(() => {});
  presenceHeartbeatId = window.setInterval(() => {
    updatePresence(currentPresenceSection).catch(() => {});
  }, PRESENCE_PULSE_MS);
}

function startCommunityCountdown(expiry) {
  clearCommunityTimers();

  if (!communityTimer) {
    return;
  }

  const update = () => {
    const remaining = Number(expiry) - Date.now();
    if (remaining <= 0) {
      communityTimer.textContent = "";
      communityTimer.classList.add("hidden");
      clearCommunityTimers();
      refreshCommunityAccess();
      return;
    }

    communityTimer.textContent = `Acces temporaire: ${formatRemainingTime(remaining)} restant`;
    communityTimer.classList.remove("hidden");
  };

  update();
  communityAccessCountdownId = window.setInterval(update, 1000);
  communityAccessExpiryTimeoutId = window.setTimeout(refreshCommunityAccess, Math.max(0, Number(expiry) - Date.now()) + 250);
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

function animateView(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  element.classList.remove("view-enter");
  void element.offsetWidth;
  element.classList.add("view-enter");
}

function setStaffPanel(panelName = "overview") {
  const normalized = ["overview", "dossiers", "videos"].includes(panelName) ? panelName : "overview";
  currentStaffPanel = normalized;

  staffTabs.forEach((tab) => {
    const isActive = tab.getAttribute("data-staff-tab") === normalized;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  staffPanels.forEach((panel) => {
    const isVisible = panel.getAttribute("data-staff-panel") === normalized;
    panel.classList.toggle("hidden", !isVisible);
  });
}

function setActiveView(viewName) {
  loginView.classList.add("hidden");
  userView.classList.add("hidden");
  staffView.classList.add("hidden");
  document.body.classList.remove("login-mode");

  if (viewName === "staff") {
    staffView.classList.remove("hidden");
    animateView(staffView);
    setStaffPanel("overview");
    renderStaffList();
    startPresenceHeartbeat("staff");
    return;
  }

  if (viewName === "user") {
    userView.classList.remove("hidden");
    animateView(userView);
    displayPseudo.textContent = currentPseudo;
    refreshCommunityAccess();
    const tempExpiry = currentPseudo ? getTemporaryAccessExpiry(currentPseudo) : 0;
    currentPresenceSection = tempExpiry > Date.now() ? TEMPORARY_ACCESS_SECTION : "community";
    startPresenceHeartbeat(currentPresenceSection);
    return;
  }

  document.body.classList.add("login-mode");
  loginView.classList.remove("hidden");
  animateView(loginView);
}

function setCommunityPanelState({ approved = false, tempActive = false, open = false } = {}) {
  currentSubmissionApproved = approved;
  currentTemporaryAccessActive = tempActive;
  const hasCommunityAccess = approved || tempActive;
  communityIsOpen = hasCommunityAccess ? (tempActive ? true : open) : false;

  if (uploadLockedNotice) {
    uploadLockedNotice.classList.toggle("hidden", !currentSubmissionApproved);
  }

  if (uploadPanel) {
    uploadPanel.classList.toggle("hidden", currentSubmissionApproved);
  }

  if (photoInput) {
    photoInput.disabled = currentSubmissionApproved;
  }

  if (staffConsent) {
    staffConsent.disabled = currentSubmissionApproved;
  }

  const submitButton = uploadForm ? uploadForm.querySelector("button[type='submit']") : null;
  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = currentSubmissionApproved;
    submitButton.textContent = currentSubmissionApproved ? "Photo deja validee" : "Envoyer la photo";
  }

  if (communityLock) {
    communityLock.classList.toggle("hidden", hasCommunityAccess);
  }

  if (communityAccess) {
    communityAccess.classList.toggle("hidden", !hasCommunityAccess);
  }

  if (communityBlock) {
    communityBlock.classList.toggle("hidden", !communityIsOpen);
  }

  if (toggleCommunity) {
    toggleCommunity.textContent = communityIsOpen ? "Masquer les dossiers" : "Voir les dossiers";
    toggleCommunity.disabled = !currentSubmissionApproved;
  }

  if (communityNotice) {
    if (currentSubmissionApproved) {
      communityNotice.textContent = communityIsOpen
        ? "Tu peux consulter, commenter et liker les dossiers."
        : "Clique pour ouvrir les dossiers des autres joueurs.";
    } else if (tempActive) {
      communityNotice.textContent = "Acces temporaire active pendant 10 minutes. Tu peux consulter les dossiers en attendant la validation staff.";
    } else {
      communityNotice.textContent = "Envoie ta photo au staff pour debloquer cet espace.";
    }
  }

  if (communityLockNotice) {
    communityLockNotice.textContent = currentSubmissionApproved
      ? "Ton profil a ete valide. Tu peux ouvrir les dossiers de la communaute."
      : "Envoie ta photo au staff pour debloquer la consultation des dossiers des autres joueurs.";
  }

  if (communityTimer) {
    const tempExpiry = !currentSubmissionApproved ? getTemporaryAccessExpiry(currentPseudo) : 0;
    const remaining = tempExpiry - Date.now();
    const active = tempActive && remaining > 0;
    communityTimer.textContent = active ? `Acces temporaire: ${formatRemainingTime(remaining)} restant` : "";
    communityTimer.classList.toggle("hidden", !active);
  }
}

function setVideoPanelState({ approved = false, open = false } = {}) {
  videosIsOpen = approved ? open : false;

  if (videosAccess) {
    videosAccess.classList.toggle("hidden", !approved);
  }

  if (videoUploadPanel) {
    videoUploadPanel.classList.toggle("hidden", !approved);
  }

  if (videosBlock) {
    videosBlock.classList.toggle("hidden", !videosIsOpen);
    videosBlock.classList.toggle("videos-stage", videosIsOpen);
  }

  if (toggleVideos) {
    toggleVideos.disabled = !approved;
    toggleVideos.textContent = videosIsOpen ? "Fermer le flux" : "Ouvrir le flux";
  }

  if (videosNotice) {
    videosNotice.textContent = approved
      ? videosIsOpen
        ? "Le flux est ouvert. Tu peux regarder les vidéos validées et proposer la tienne."
        : "Ouvre le flux vidéo pour parcourir les publications et poster la tienne."
      : "Accès réservé aux comptes vérifiés.";
  }

  if (videoUploadNotice && approved) {
    videoUploadNotice.classList.add("hidden");
    videoUploadNotice.textContent = "";
  }

  document.body.classList.toggle("videos-theme", Boolean(approved && videosIsOpen));
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
  if (videoUploadForm) {
    videoUploadForm.reset();
  }
  if (videoUploadNotice) {
    videoUploadNotice.classList.add("hidden");
    videoUploadNotice.textContent = "";
  }
  hideStatus();
  clearCommunityTimers();
  clearPresenceHeartbeat();
  document.body.classList.remove("videos-theme");
  closeVideoModal();
  setCommunityPanelState({ approved: false, tempActive: false, open: false });
  setVideoPanelState({ approved: false, open: false });
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
  const safePath = String(path || "").trim();
  if (!safePath) {
    return "";
  }
  const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(safePath);
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
  if (normalized === "en attente") {
    return "en-attente";
  }
  if (normalized === "accepté") {
    return "accepted";
  }
  if (normalized === "refusé") {
    return "refused";
  }
  return normalized.replace(/[^a-z0-9]+/g, "-");
}

function getVideoStatusLabel(value) {
  return VIDEO_STATUS_LABELS[value] || value || "En attente";
}

function getVideoStatusClass(value) {
  const normalized = String(value || "en attente").toLowerCase();
  if (normalized === "en attente") {
    return "en-attente";
  }
  if (normalized === "publiée") {
    return "published";
  }
  if (normalized === "refusée") {
    return "refused";
  }
  return normalized.replace(/[^a-z0-9]+/g, "-");
}

function getVideoAvatarInitial(pseudo = "") {
  const trimmed = String(pseudo || "").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "N";
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

function updateStaffStats(entries = [], storageUsage = null, presenceRows = [], recentActivity = { comments: [], likes: [] }) {
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

  const onlineUsers = presenceRows.filter((row) => {
    const lastSeen = new Date(row.last_seen_at || 0).getTime();
    return Number.isFinite(lastSeen) && Date.now() - lastSeen < 2 * 60 * 1000;
  });
  const tempUsers = presenceRows.filter((row) => {
    const expiry = new Date(row.temp_access_until || 0).getTime();
    return Number.isFinite(expiry) && expiry > Date.now();
  });
  const recentComments = Array.isArray(recentActivity.comments) ? recentActivity.comments : [];
  const recentLikes = Array.isArray(recentActivity.likes) ? recentActivity.likes : [];

  const storageMarkup =
    storageUsage && Number.isFinite(storageUsage.usedPercent)
      ? `<span class="staff-stat">${escapeHtml(storageUsage.usedPercent.toFixed(2))}% stockage utilise (${escapeHtml(
          formatBytes(storageUsage.usedBytes)
        )}/${escapeHtml(formatBytes(storageUsage.quotaBytes))})</span>`
      : "";

  staffStats.innerHTML = `
    <span class="staff-stat">Total : <strong>${entries.length}</strong></span>
    <span class="staff-stat staff-stat--pending">${counts["en attente"] || 0} en attente</span>
    <span class="staff-stat staff-stat--accepted">${counts["accepté"] || 0} acceptés</span>
    <span class="staff-stat staff-stat--refused">${counts["refusé"] || 0} refusés</span>
    <span class="staff-stat staff-stat--priority">${priorityCount} prioritaires</span>
    <span class="staff-stat">Visiteurs actifs : <strong>${onlineUsers.length}</strong></span>
    <span class="staff-stat">Acces temporaires : <strong>${tempUsers.length}</strong></span>
    <span class="staff-stat">Commentaires recents : <strong>${recentComments.length}</strong></span>
    <span class="staff-stat">Likes recents : <strong>${recentLikes.length}</strong></span>
    ${storageMarkup}
  `;

  renderStaffInsights({
    onlineUsers,
    tempUsers,
    recentComments,
    recentLikes
  });
}

function formatBytes(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return "0 B";
  }
  if (num < 1024) {
    return `${num.toFixed(0)} B`;
  }
  if (num < 1024 ** 2) {
    return `${(num / 1024).toFixed(1)} KB`;
  }
  if (num < 1024 ** 3) {
    return `${(num / (1024 ** 2)).toFixed(1)} MB`;
  }
  return `${(num / (1024 ** 3)).toFixed(2)} GB`;
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

async function updateVideoField(videoId, payload) {
  if (!supabaseClient) {
    throw new Error("Configuration Supabase manquante");
  }

  const { error } = await supabaseClient.from("staff_videos").update(payload).eq("id", videoId);
  if (error) {
    throw new Error(error.message || "Mise à jour video impossible");
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

async function fetchCommunitySubmissions() {
  const selectFields = schemaSupportsPublicStatus
    ? "id, pseudo, photo_path, created_at, status"
    : "id, pseudo, photo_path, created_at";

  const { data, error } = await supabaseClient
    .from("submissions")
    .select(selectFields)
    .order("created_at", { ascending: false })
    .limit(36);

  if (error) {
    const message = String(error.message || "");
    if (schemaSupportsPublicStatus && /(submissions\.)?status\s+does not exist/i.test(message)) {
      schemaSupportsPublicStatus = false;
      return fetchCommunitySubmissions();
    }
    throw new Error(message || "Lecture des photos impossible");
  }

  return Array.isArray(data) ? data : [];
}

async function fetchLatestAcceptedSubmissionPhotoPath(pseudo) {
  if (!supabaseClient || !pseudo) {
    return "";
  }

  const { data, error } = await supabaseClient
    .from("submissions")
    .select("photo_path, status, created_at")
    .eq("pseudo", pseudo)
    .eq("status", "accepté")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    const message = String(error.message || "");
    if (schemaSupportsPublicStatus && /(submissions\.)?status\s+does not exist/i.test(message)) {
      schemaSupportsPublicStatus = false;
      return "";
    }
    throw new Error(message || "Lecture du dossier valide impossible");
  }

  return Array.isArray(data) && data.length ? String(data[0]?.photo_path || "") : "";
}

function getVideoEntriesForPublic(entries = []) {
  return entries.filter((entry) => {
    const status = String(entry?.status || "publiée");
    return !schemaSupportsVideoMetadata || status === "publiée" || status === "accepté";
  });
}

function hasOwnAcceptedSubmission(entries = []) {
  if (!schemaSupportsPublicStatus) {
    return true;
  }
  return entries.some((entry) => entry.pseudo === currentPseudo && entry.status === "accepté");
}

function pickVisibleCommunityEntries(entries = [], canViewAll = false) {
  if (!canViewAll) {
    return [];
  }
  return entries.filter((entry) => entry.photo_path);
}

function groupBySubmission(rows = []) {
  return rows.reduce((acc, row) => {
    const submissionId = String(row?.submission_id || "");
    if (!submissionId) {
      return acc;
    }
    if (!acc[submissionId]) {
      acc[submissionId] = [];
    }
    acc[submissionId].push(row);
    return acc;
  }, {});
}

function renderCommunityEntries(entries = [], commentsBySubmission = {}, likesBySubmission = {}) {
  if (!communityGallery) {
    return;
  }

  if (!entries.length) {
    communityGallery.innerHTML = '<div class="community-empty">Aucune photo disponible pour le moment.</div>';
    if (communityNotice) {
      communityNotice.textContent = "Aucun dossier disponible pour le moment.";
    }
    return;
  }

  const cards = entries
    .map((entry, index) => {
      const submissionId = String(entry.id || "");
      const photoUrl = buildPublicPhotoUrl(entry.photo_path || "");
      const safePhotoUrl = escapeHtml(photoUrl);
      const safePseudo = escapeHtml(entry.pseudo || "Joueur");
      const safeTime = escapeHtml(formatDate(entry.created_at));
      const safeStatus = escapeHtml(getStatusLabel(entry.status || "en attente"));
      const entryComments = Array.isArray(commentsBySubmission[submissionId])
        ? commentsBySubmission[submissionId]
        : [];
      const entryLikes = Array.isArray(likesBySubmission[submissionId]) ? likesBySubmission[submissionId] : [];
      const likedByCurrent = entryLikes.some((like) => like.pseudo === currentPseudo);
      const commentsMarkup = entryComments.length
        ? entryComments
            .map((comment) => {
              const commentPseudo = escapeHtml(comment.pseudo || "Anonyme");
              const commentBody = escapeHtml(comment.body || "");
              const commentTime = escapeHtml(formatDate(comment.created_at));
              return `
                <article class="community-comment">
                  <strong>${commentPseudo}</strong>
                  <p>${commentBody}</p>
                  <span>${commentTime}</span>
                </article>
              `;
            })
            .join("")
        : '<div class="community-comment community-comment--empty">Aucun commentaire pour le moment.</div>';
      const commentsCount = entryComments.length;
      const likesCount = entryLikes.length;
      return `
        <article class="community-card community-card--tiktok" style="--delay:${index * 45}ms">
          <div class="community-card-media">
            <img src="${safePhotoUrl}" alt="Dossier de ${safePseudo}" loading="lazy" />
            <div class="community-card-overlay">
              <div class="community-card-topline">
                <div>
                  <strong>${safePseudo}</strong>
                  <span>${safeTime}</span>
                </div>
                <span class="community-status">${safeStatus}</span>
              </div>
              <div class="community-card-actions">
                <button
                  class="ghost community-like"
                  type="button"
                  data-submission-id="${escapeHtml(submissionId)}"
                  data-liked="${likedByCurrent ? "true" : "false"}"
                >
                  ${likedByCurrent ? "Liked" : "Like"} <span>${likesCount}</span>
                </button>
                <button class="ghost community-jump-comments" type="button" data-submission-id="${escapeHtml(submissionId)}">
                  Comment <span>${commentsCount}</span>
                </button>
              </div>
            </div>
          </div>
          <div class="community-card-body">
            <div class="community-comments">
              <div class="community-comments-list">
                ${commentsMarkup}
              </div>
              <form class="community-comment-form" data-submission-id="${escapeHtml(submissionId)}">
                <textarea
                  name="comment"
                  rows="2"
                  maxlength="280"
                  placeholder="Ecrire un commentaire..."
                  required
                ></textarea>
                <button type="submit">Publier</button>
              </form>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  communityGallery.innerHTML = cards;
}

async function fetchSubmissionComments(submissionIds = []) {
  if (!supabaseClient || !submissionIds.length) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("submission_comments")
    .select("id, submission_id, pseudo, body, created_at")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: true });

  if (error) {
    const message = String(error.message || "");
    if (schemaSupportsCommunityComments && /submission_comments/i.test(message) && /does not exist/i.test(message)) {
      schemaSupportsCommunityComments = false;
      return [];
    }
    throw new Error(error.message || "Lecture des commentaires impossible");
  }

  return Array.isArray(data) ? data : [];
}

async function fetchSubmissionLikes(submissionIds = []) {
  if (!supabaseClient || !submissionIds.length) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("submission_likes")
    .select("id, submission_id, pseudo, created_at")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: true });

  if (error) {
    const message = String(error.message || "");
    if (schemaSupportsCommunityLikes && /submission_likes/i.test(message) && /does not exist/i.test(message)) {
      schemaSupportsCommunityLikes = false;
      return [];
    }
    throw new Error(error.message || "Lecture des likes impossible");
  }

  return Array.isArray(data) ? data : [];
}

async function fetchSitePresence() {
  if (!supabaseClient || !schemaSupportsPresence) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("site_presence")
    .select("pseudo, current_section, last_seen_at, temp_access_until")
    .order("last_seen_at", { ascending: false });

  if (error) {
    const message = String(error.message || "");
    if (/site_presence/i.test(message) && /does not exist/i.test(message)) {
      schemaSupportsPresence = false;
      return [];
    }
    throw new Error(message || "Lecture de la presence impossible");
  }

  return Array.isArray(data) ? data : [];
}

async function fetchRecentCommunityActivity(limit = 25) {
  if (!supabaseClient) {
    return { comments: [], likes: [] };
  }

  const commentsQuery = supabaseClient
    .from("submission_comments")
    .select("pseudo, body, created_at, submission_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  const likesQuery = supabaseClient
    .from("submission_likes")
    .select("pseudo, created_at, submission_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  const [{ data: comments, error: commentsError }, { data: likes, error: likesError }] = await Promise.all([
    commentsQuery,
    likesQuery
  ]);

  if (commentsError) {
    const message = String(commentsError.message || "");
    if (/submission_comments/i.test(message) && /does not exist/i.test(message)) {
      schemaSupportsCommunityComments = false;
      return { comments: [], likes: [] };
    }
    throw new Error(message || "Lecture des commentaires recents impossible");
  }
  if (likesError) {
    const message = String(likesError.message || "");
    if (/submission_likes/i.test(message) && /does not exist/i.test(message)) {
      schemaSupportsCommunityLikes = false;
      return { comments: [], likes: [] };
    }
    throw new Error(message || "Lecture des likes recents impossible");
  }

  return {
    comments: Array.isArray(comments) ? comments : [],
    likes: Array.isArray(likes) ? likes : []
  };
}

async function fetchStaffVideos() {
  if (!supabaseClient) {
    return [];
  }

  const selectFields = schemaSupportsVideoMetadata
    ? "id, pseudo, title, video_path, profile_photo_path, duration_seconds, status, staff_note, created_at"
    : "id, title, video_path, duration_seconds, created_at";

  const { data, error } = await supabaseClient
    .from("staff_videos")
    .select(selectFields)
    .order("created_at", { ascending: false })
    .limit(48);

  if (error) {
    const message = String(error.message || "");
    if (schemaSupportsStaffVideos && /staff_videos/i.test(message) && /does not exist/i.test(message)) {
      schemaSupportsStaffVideos = false;
      return [];
    }
    if (schemaSupportsVideoMetadata && /(pseudo|profile_photo_path|status|staff_note)\s+does not exist/i.test(message)) {
      schemaSupportsVideoMetadata = false;
      return fetchStaffVideos();
    }
    throw new Error(message || "Lecture des videos impossible");
  }

  return Array.isArray(data) ? data : [];
}

async function deleteStaffVideo(videoId, videoPath) {
  const safeVideoPath = String(videoPath || "").trim();
  if (safeVideoPath) {
    const { error: storageError } = await supabaseClient.storage.from("videos").remove([safeVideoPath]);
    if (storageError) {
      throw new Error(storageError.message || "Suppression video impossible");
    }
  }

  const { error: dbError } = await supabaseClient.from("staff_videos").delete().eq("id", videoId);
  if (dbError) {
    throw new Error(dbError.message || "Suppression video impossible");
  }
}

function formatVideoDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function buildProtectedVideoUrl(path) {
  const safePath = String(path || "").trim();
  if (!safePath) {
    return "";
  }
  const { data } = supabaseClient.storage.from("videos").getPublicUrl(safePath);
  return data?.publicUrl || "";
}

function buildVideoAvatarMarkup(video = {}) {
  const photoUrl = buildPublicPhotoUrl(video.profile_photo_path || "");
  const pseudo = String(video.pseudo || "").trim();
  const initial = escapeHtml(getVideoAvatarInitial(pseudo));
  if (photoUrl) {
    return `
      <div class="video-card-avatar video-card-avatar--image">
        <img src="${escapeHtml(photoUrl)}" alt="Photo de profil de ${escapeHtml(pseudo || "Joueur")}" loading="lazy" />
      </div>
    `;
  }
  return `<div class="video-card-avatar">${initial}</div>`;
}

async function resolveVideoProfilePhotoPath(pseudo) {
  const photoPath = await fetchLatestAcceptedSubmissionPhotoPath(pseudo);
  return String(photoPath || "").trim();
}

async function uploadVideoRecord({ pseudo, title, file, status }) {
  const durationSeconds = await getMediaDurationSeconds(file);
  if (durationSeconds > 300) {
    throw new Error("La video doit durer 5 minutes maximum");
  }

  const safePseudo = sanitizePseudoForFile(pseudo);
  const safeTitle = String(title || "").trim().slice(0, 80) || "video";
  const fileExt = extensionFromFile(file.name);
  const filePath = `${safePseudo}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
  const profilePhotoPath = await resolveVideoProfilePhotoPath(pseudo);

  if (status === "en attente" && !profilePhotoPath) {
    throw new Error("Ton dossier doit etre valide avant de poster une video.");
  }

  const { error: uploadError } = await supabaseClient.storage.from("videos").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (uploadError) {
    throw new Error(uploadError.message || "Upload video impossible");
  }

  const payload = {
    pseudo,
    title: safeTitle,
    video_path: filePath,
    profile_photo_path: profilePhotoPath,
    duration_seconds: durationSeconds,
    status: VIDEO_STATUS_OPTIONS.includes(status) ? status : "en attente",
    staff_note: ""
  };

  if (payload.status === "publiée") {
    payload.approved_at = new Date().toISOString();
  }

  const { error: insertError } = await supabaseClient.from("staff_videos").insert([payload]);

  if (insertError) {
    await supabaseClient.storage.from("videos").remove([filePath]);
    throw new Error(insertError.message || "Ecriture video impossible");
  }
}

async function uploadStaffVideo(title, file) {
  await uploadVideoRecord({
    pseudo: currentPseudo || STAFF_PSEUDO,
    title,
    file,
    status: "publiée"
  });
}

function openVideoModal(video) {
  if (!videoModal || !videoModalPlayer) {
    return;
  }

  const videoUrl = buildProtectedVideoUrl(video?.video_path || "");
  if (!videoUrl) {
    return;
  }

  currentVideoModalUrl = videoUrl;
  videoModalPlayer.src = videoUrl;
  videoModalPlayer.load();
  if (videoModalTitle) {
    videoModalTitle.textContent = video?.title || "Video du staff";
  }
  if (videoModalInfo) {
    const duration = formatVideoDuration(video?.duration_seconds);
    const published = formatDate(video?.created_at);
    const pseudo = String(video?.pseudo || "").trim() || "Joueur";
    videoModalInfo.textContent = `${pseudo} · ${duration} · ${published}`;
  }

  videoModal.classList.remove("hidden");
  videoModal.classList.add("visible");
  videoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("video-modal-open");
  videoModalPlayer.play().catch(() => {});
}

function closeVideoModal() {
  if (!videoModal || !videoModalPlayer) {
    return;
  }

  videoModalPlayer.pause();
  videoModalPlayer.removeAttribute("src");
  videoModalPlayer.load();
  currentVideoModalUrl = "";
  videoModal.classList.add("hidden");
  videoModal.classList.remove("visible");
  videoModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("video-modal-open");
}

async function getMediaDurationSeconds(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement("video");
    media.preload = "metadata";
    media.src = url;
    media.onloadedmetadata = () => {
      const duration = Math.round(media.duration || 0);
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    media.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire la durée de la video"));
    };
  });
}

async function uploadStaffVideo(title, file) {
  const durationSeconds = await getMediaDurationSeconds(file);
  if (durationSeconds > 300) {
    throw new Error("La video doit durer 5 minutes maximum");
  }

  const safeTitle = String(title || "").trim().slice(0, 80) || "video-staff";
  const fileExt = extensionFromFile(file.name);
  const filePath = `${sanitizePseudoForFile(STAFF_PSEUDO)}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabaseClient.storage.from("videos").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (uploadError) {
    throw new Error(uploadError.message || "Upload video impossible");
  }

  const { error: insertError } = await supabaseClient.from("staff_videos").insert([
    {
      title: safeTitle,
      video_path: filePath,
      duration_seconds: durationSeconds
    }
  ]);

  if (insertError) {
    await supabaseClient.storage.from("videos").remove([filePath]);
    throw new Error(insertError.message || "Ecriture video impossible");
  }
}

function renderStaffInsights({ onlineUsers = [], tempUsers = [], recentComments = [], recentLikes = [] } = {}) {
  if (!staffInsights) {
    return;
  }

  const onlineMarkup = onlineUsers.length
    ? onlineUsers
        .map((row) => `<span class="staff-stat">${escapeHtml(row.pseudo)} · ${escapeHtml(row.current_section || "site")}</span>`)
        .join("")
    : '<span class="staff-stat">Aucun visiteur actif</span>';

  const tempMarkup = tempUsers.length
    ? tempUsers
        .map((row) => `<span class="staff-stat">${escapeHtml(row.pseudo)} · ${escapeHtml(formatDate(row.last_seen_at))}</span>`)
        .join("")
    : '<span class="staff-stat">Aucun accès temporaire actif</span>';

  const combinedRecent = [...recentComments.map((item) => ({ ...item, kind: "comment" })), ...recentLikes.map((item) => ({ ...item, kind: "like" }))]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  const recentMarkup = combinedRecent
    .map((item) => {
      const shortId = String(item.submission_id || "").slice(0, 8);
      if (item.kind === "comment") {
        return `<li>${escapeHtml(item.pseudo)} a commenté le dossier ${escapeHtml(shortId)} à ${escapeHtml(formatDate(item.created_at))}</li>`;
      }
      return `<li>${escapeHtml(item.pseudo)} a liké le dossier ${escapeHtml(shortId)} à ${escapeHtml(formatDate(item.created_at))}</li>`;
    })
    .join("");

  staffInsights.innerHTML = `
    <div class="staff-insight">
      <strong>Visiteurs actifs</strong>
      <div class="staff-insight-list">${onlineMarkup}</div>
    </div>
    <div class="staff-insight">
      <strong>Acces temporaires</strong>
      <div class="staff-insight-list">${tempMarkup}</div>
    </div>
    <div class="staff-insight">
      <strong>Activite recente</strong>
      <ul class="staff-activity-list">${recentMarkup || "<li>Aucune activité récente</li>"}</ul>
    </div>
  `;
}

async function renderCommunityGallery() {
  if (!supabaseClient || !communityGallery || !communityIsOpen) {
    if (communityGallery) {
      communityGallery.innerHTML = "";
    }
    return;
  }

  communityGallery.innerHTML = '<div class="community-empty">Chargement des photos...</div>';

  try {
    const allEntries = await fetchCommunitySubmissions();
    const visibleEntries = pickVisibleCommunityEntries(allEntries, true);
    const submissionIds = visibleEntries.map((entry) => String(entry.id || "")).filter(Boolean);
    const [comments, likes] = await Promise.all([
      fetchSubmissionComments(submissionIds),
      fetchSubmissionLikes(submissionIds)
    ]);
    renderCommunityEntries(visibleEntries, groupBySubmission(comments), groupBySubmission(likes));
  } catch (error) {
    communityGallery.innerHTML = `<div class="community-empty">${escapeHtml(
      error.message || "Erreur de chargement des photos"
    )}</div>`;
    if (communityNotice) {
      communityNotice.textContent = "Impossible de charger la galerie pour le moment.";
    }
  }
}

function renderVideosFeed(videos = []) {
  if (!videosFeed) {
    return;
  }

  const visibleVideos = getVideoEntriesForPublic(videos);

  if (!visibleVideos.length) {
    videosFeed.innerHTML = '<div class="community-empty">Aucune vidéo validée pour le moment.</div>';
    return;
  }

  videosFeed.innerHTML = visibleVideos
    .map((video, index) => {
      const videoId = escapeHtml(video.id || "");
      const safeTitle = escapeHtml(video.title || "Video du staff");
      const safeDuration = escapeHtml(formatVideoDuration(video.duration_seconds));
      const safeTime = escapeHtml(formatDate(video.created_at));
      const safePath = escapeHtml(video.video_path || "");
      const safeUrl = escapeHtml(buildProtectedVideoUrl(video.video_path || ""));
      const safePseudo = escapeHtml(video.pseudo || "Joueur");
      const avatarMarkup = buildVideoAvatarMarkup(video);
      return `
        <article class="video-card video-card--youtube" data-video-id="${videoId}" data-video-path="${safePath}" data-video-title="${safeTitle}" data-video-duration="${escapeHtml(
          String(video.duration_seconds || 0)
        )}" data-video-created="${escapeHtml(String(video.created_at || ""))}" style="--delay:${index * 60}ms">
          <div class="video-card-thumb">
            <video src="${safeUrl}" muted autoplay loop playsinline preload="metadata"></video>
            <span class="video-card-duration">${safeDuration}</span>
          </div>
          <div class="video-card-meta">
            <div class="video-card-channel">
              ${avatarMarkup}
              <div>
                <strong>${safeTitle}</strong>
                <span>${safePseudo}</span>
                <span class="video-card-subline">Vidéo validée · ${safeTime}</span>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderStaffVideosList(videos = []) {
  if (!staffVideosList) {
    return;
  }

  if (!videos.length) {
    staffVideosList.innerHTML = '<div class="community-empty">Aucune vidéo publiée pour le moment.</div>';
    return;
  }

  staffVideosList.innerHTML = videos
    .map((video, index) => {
      const safeId = escapeHtml(video.id || "");
      const safePseudo = escapeHtml(video.pseudo || "inconnu");
      const safeTitle = escapeHtml(video.title || "Video du staff");
      const safeDuration = escapeHtml(formatVideoDuration(video.duration_seconds));
      const safeTime = escapeHtml(formatDate(video.created_at));
      const safeUrl = escapeHtml(buildProtectedVideoUrl(video.video_path || ""));
      const currentStatus = VIDEO_STATUS_OPTIONS.includes(video.status) ? video.status : "en attente";
      const statusClass = getVideoStatusClass(currentStatus);
      const statusLabel = getVideoStatusLabel(currentStatus);
      const optionNodes = VIDEO_STATUS_OPTIONS.map(
        (option) =>
          `<option value="${option}" ${option === currentStatus ? "selected" : ""}>${getVideoStatusLabel(option)}</option>`
      ).join("");
      const avatarMarkup = buildVideoAvatarMarkup(video);
      return `
        <article class="staff-video-item" style="--delay:${index * 60}ms">
          <div class="staff-video-preview">
            <video src="${safeUrl}" controls playsinline preload="metadata"></video>
            <span class="staff-video-ribbon">Espace staff</span>
          </div>
          <div class="staff-video-item-meta">
            <div class="staff-video-item-channel">
              ${avatarMarkup}
              <div>
                <strong>${safeTitle}</strong>
                <span>${safePseudo} · ${safeDuration} · ${safeTime}</span>
              </div>
              <span class="status-chip status-chip--${statusClass}">${statusLabel}</span>
            </div>
            <label class="entry-status">
              <span>Statut de publication</span>
              <select data-video-id="${safeId}">
                ${optionNodes}
              </select>
            </label>
            <div class="staff-video-actions">
              <button class="secondary staff-video-delete" type="button" data-id="${safeId}" data-path="${escapeHtml(video.video_path || "")}">
                Supprimer
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function renderVideosSection() {
  if (!supabaseClient || !videosFeed || !videosIsOpen) {
    if (videosFeed) {
      videosFeed.innerHTML = "";
    }
    return;
  }

  videosFeed.innerHTML = '<div class="community-empty">Chargement des vidéos...</div>';

  try {
    const videos = await fetchStaffVideos();
    renderVideosFeed(videos);
  } catch (error) {
    videosFeed.innerHTML = `<div class="community-empty">${escapeHtml(error.message || "Erreur de chargement des vidéos")}</div>`;
  }
}

async function renderStaffVideosSection() {
  if (!supabaseClient || !staffVideosList) {
    return;
  }

  staffVideosList.innerHTML = '<div class="community-empty">Chargement des vidéos...</div>';

  try {
    const videos = await fetchStaffVideos();
    staffVideosCache = Array.isArray(videos) ? videos : [];
    renderStaffVideosList(staffVideosCache);
  } catch (error) {
    staffVideosList.innerHTML = `<div class="community-empty">${escapeHtml(error.message || "Erreur de chargement des vidéos")}</div>`;
  }
}

async function refreshCommunityAccess() {
  if (!supabaseClient || !currentPseudo) {
    clearCommunityTimers();
    setCommunityPanelState({ approved: false, tempActive: false, open: false });
    setVideoPanelState({ approved: false, open: false });
    return;
  }

  try {
    const submissions = await fetchSubmissions();
    const approved = hasOwnAcceptedSubmission(submissions);
    const tempExpiry = approved ? 0 : getTemporaryAccessExpiry(currentPseudo);
    const tempActive = !approved && tempExpiry > Date.now();

    if (!approved && !tempActive) {
      clearCommunityTimers();
      if (tempExpiry > 0) {
        clearTemporaryAccessExpiry(currentPseudo);
      }
      setCommunityPanelState({ approved: false, tempActive: false, open: false });
      setVideoPanelState({ approved: false, open: false });
      if (communityGallery) {
        communityGallery.innerHTML = "";
      }
      return;
    }

    setCommunityPanelState({
      approved,
      tempActive,
      open: approved ? communityIsOpen : true
    });
    currentPresenceSection = approved ? (communityIsOpen ? "community" : "community") : TEMPORARY_ACCESS_SECTION;
    setVideoPanelState({ approved, open: approved ? videosIsOpen : false });
    startPresenceHeartbeat(currentPresenceSection);

    if (tempActive) {
      startCommunityCountdown(tempExpiry);
    } else {
      clearCommunityTimers();
    }

    if (communityIsOpen) {
      await renderCommunityGallery();
    }
  } catch (error) {
    clearCommunityTimers();
    setCommunityPanelState({ approved: false, tempActive: false, open: false });
    setVideoPanelState({ approved: false, open: false });
    if (communityNotice) {
      communityNotice.textContent = error.message || "Impossible de verifier l'acces.";
    }
  }
}

async function fetchStorageUsage() {
  if (!schemaSupportsStorageStats) {
    return null;
  }

  const { data, error } = await supabaseClient.rpc("staff_storage_usage", {
    target_bucket: STORAGE_BUCKET,
    max_quota_bytes: STORAGE_QUOTA_BYTES
  });

  if (error) {
    const message = String(error.message || "");
    if (/staff_storage_usage/i.test(message) && /does not exist/i.test(message)) {
      schemaSupportsStorageStats = false;
      return null;
    }
    throw new Error(message || "Lecture du stockage impossible");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return null;
  }

  return {
    usedPercent: Number(row.used_percent),
    usedBytes: Number(row.used_bytes),
    quotaBytes: Number(row.quota_bytes)
  };
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
    const [submissions, storageUsage, presenceRows, recentActivity, videos] = await Promise.all([
      fetchSubmissions(),
      fetchStorageUsage(),
      fetchSitePresence(),
      fetchRecentCommunityActivity(),
      fetchStaffVideos()
    ]);
    staffCache = Array.isArray(submissions) ? submissions : [];
    staffVideosCache = Array.isArray(videos) ? videos : [];
    populateFloatingPhotos(staffCache);
    updateStaffStats(staffCache, storageUsage, presenceRows, recentActivity);
    renderStaffEntries(applyStaffFilters(staffCache));
    renderStaffVideosList(staffVideosCache);
  } catch (error) {
    staffList.innerHTML = `<div class="empty">${escapeHtml(error.message || "Erreur de lecture")}</div>`;
    populateFloatingPhotos([]);
    updateStaffStats([]);
    renderStaffVideosList([]);
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

  if (currentSubmissionApproved) {
    setStatus("Ton compte est deja valide, tu ne peux plus republier de photo.", "error");
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
    const tempExpiry = Date.now() + TEMP_ACCESS_DURATION_MS;
    setTemporaryAccessExpiry(currentPseudo, tempExpiry);
    setStatus(
      "Photo envoyee. En attendant que le staff te valide et te donne l'acces au server Discord, tu as acces aux dossiers pendant 10 minutes.",
      "success"
    );
    alert("bien envoyé vous pouvez fermé le site");
    uploadForm.reset();
    await Promise.all([refreshFloatingPhotos(), refreshCommunityAccess()]);
  } catch (error) {
    setStatus(`Erreur pendant l'envoi: ${error.message || "reessaie"}`, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

if (videoUploadForm) {
  videoUploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      if (videoUploadNotice) {
        videoUploadNotice.textContent = "Configuration serveur manquante.";
        videoUploadNotice.classList.remove("hidden");
      }
      return;
    }

    if (!currentPseudo) {
      if (videoUploadNotice) {
        videoUploadNotice.textContent = "Session invalide, reconnecte-toi.";
        videoUploadNotice.classList.remove("hidden");
      }
      return;
    }

    if (!currentSubmissionApproved) {
      if (videoUploadNotice) {
        videoUploadNotice.textContent = "Ton dossier doit etre valide avant de poster une video.";
        videoUploadNotice.classList.remove("hidden");
      }
      return;
    }

    const title = (videoUploadTitle?.value || "").trim();
    const file = videoUploadFile?.files?.[0];
    if (!title || !file) {
      if (videoUploadNotice) {
        videoUploadNotice.textContent = "Ajoute un titre et une video.";
        videoUploadNotice.classList.remove("hidden");
      }
      return;
    }

    const submitBtn = videoUploadForm.querySelector("button[type='submit']");
    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = true;
    }

    if (videoUploadNotice) {
      videoUploadNotice.textContent = "Envoi de la video en attente de validation...";
      videoUploadNotice.classList.remove("hidden");
    }

    try {
      await uploadVideoRecord({
        pseudo: currentPseudo,
        title,
        file,
        status: "en attente"
      });
      if (videoUploadNotice) {
        videoUploadNotice.textContent = "Video envoyee. Le staff doit la valider avant publication.";
        videoUploadNotice.classList.remove("hidden");
      }
      videoUploadForm.reset();
      await Promise.all([renderVideosSection(), renderStaffVideosSection()]);
    } catch (error) {
      if (videoUploadNotice) {
        videoUploadNotice.textContent = error.message || "Publication video impossible.";
        videoUploadNotice.classList.remove("hidden");
      }
    } finally {
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = false;
      }
    }
  });
}

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

if (staffVideosList) {
  staffVideosList.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches("select[data-video-id]")) {
      return;
    }

    if (!isStaffPseudo()) {
      return;
    }

    const videoId = target.getAttribute("data-video-id");
    const newStatus = target.value;
    if (!videoId || !VIDEO_STATUS_OPTIONS.includes(newStatus)) {
      return;
    }

    target.disabled = true;
    try {
      const payload = {
        status: newStatus
      };
      if (newStatus === "publiée") {
        payload.approved_at = new Date().toISOString();
      }
      await updateVideoField(videoId, payload);
      await Promise.all([renderVideosSection(), renderStaffVideosSection()]);
    } catch (error) {
      alert(`Erreur de mise a jour video: ${error.message || "reessaie"}`);
    } finally {
      target.disabled = false;
    }
  });
}

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
  setStaffPanel("dossiers");
  renderStaffEntries(applyStaffFilters(staffCache));
}

if (staffTabs.length) {
  staffTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setStaffPanel(tab.getAttribute("data-staff-tab") || "overview");
    });
  });
}

if (statusFilter) {
  statusFilter.addEventListener("change", handleStaffFiltersChange);
}

if (searchStaff) {
  searchStaff.addEventListener("input", handleStaffFiltersChange);
}

if (refreshStaff) {
  refreshStaff.addEventListener("click", () => {
    setStaffPanel("dossiers");
    renderStaffList();
  });
}

if (refreshStaffVideos) {
  refreshStaffVideos.addEventListener("click", () => {
    setStaffPanel("videos");
    renderStaffVideosSection();
  });
}

if (staffVideoForm) {
  staffVideoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient || !currentPseudo) {
      if (staffVideoNotice) {
        staffVideoNotice.textContent = "Connexion staff manquante.";
        staffVideoNotice.classList.remove("hidden");
      }
      return;
    }

    if (!isStaffPseudo()) {
      if (staffVideoNotice) {
        staffVideoNotice.textContent = "Acces reserve au staff.";
        staffVideoNotice.classList.remove("hidden");
      }
      return;
    }

    const title = (staffVideoTitle?.value || "").trim();
    const file = staffVideoFile?.files?.[0];
    if (!title || !file) {
      if (staffVideoNotice) {
        staffVideoNotice.textContent = "Ajoute un titre et une video.";
        staffVideoNotice.classList.remove("hidden");
      }
      return;
    }

    const submitBtn = staffVideoForm.querySelector("button[type='submit']");
    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = true;
    }

    try {
      await uploadStaffVideo(title, file);
      if (staffVideoNotice) {
        staffVideoNotice.textContent = "Video publiee.";
        staffVideoNotice.classList.remove("hidden");
      }
      staffVideoForm.reset();
      await Promise.all([renderVideosSection(), renderStaffVideosSection()]);
    } catch (error) {
      if (staffVideoNotice) {
        staffVideoNotice.textContent = error.message || "Publication video impossible.";
        staffVideoNotice.classList.remove("hidden");
      }
    } finally {
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = false;
      }
    }
  });
}

if (toggleCommunity) {
  toggleCommunity.addEventListener("click", async () => {
    if (!currentSubmissionApproved && !currentTemporaryAccessActive) {
      return;
    }
    currentPresenceSection = "community";
    startPresenceHeartbeat("community");
    communityIsOpen = !communityIsOpen;
    setCommunityPanelState({
      approved: currentSubmissionApproved,
      tempActive: currentTemporaryAccessActive,
      open: communityIsOpen
    });
    if (communityIsOpen) {
      await renderCommunityGallery();
    } else if (communityGallery) {
      communityGallery.innerHTML = "";
    }
  });
}

if (toggleVideos) {
  toggleVideos.addEventListener("click", async () => {
    if (!currentSubmissionApproved) {
      return;
    }
    videosIsOpen = !videosIsOpen;
    setVideoPanelState({ approved: true, open: videosIsOpen });
    if (videosIsOpen) {
      currentPresenceSection = "videos";
      startPresenceHeartbeat("videos");
      await renderVideosSection();
    } else if (videosFeed) {
      currentPresenceSection = "community";
      startPresenceHeartbeat("community");
      videosFeed.innerHTML = "";
    }
  });
}

if (refreshVideos) {
  refreshVideos.addEventListener("click", renderVideosSection);
}

if (videosFeed) {
  videosFeed.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const card = target.closest(".video-card");
    if (!(card instanceof HTMLElement)) {
      return;
    }

    const video = {
      id: card.getAttribute("data-video-id") || "",
      video_path: card.getAttribute("data-video-path") || "",
      title: card.getAttribute("data-video-title") || "Video du staff",
      duration_seconds: Number(card.getAttribute("data-video-duration") || 0),
      created_at: card.getAttribute("data-video-created") || ""
    };

    openVideoModal(video);
  });
}

if (videoModal) {
  videoModal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest("[data-close-video-modal]")) {
      closeVideoModal();
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !videoModal?.classList.contains("hidden")) {
    closeVideoModal();
  }
});

if (staffVideosList) {
  staffVideosList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (!isStaffPseudo()) {
      return;
    }

    const deleteButton = target.closest(".staff-video-delete");
    if (!(deleteButton instanceof HTMLElement)) {
      return;
    }

    const videoId = deleteButton.getAttribute("data-id");
    const videoPath = deleteButton.getAttribute("data-path") || "";
    if (!videoId) {
      return;
    }

    const shouldDelete = confirm("Supprimer cette video ?");
    if (!shouldDelete) {
      return;
    }

    deleteButton.setAttribute("disabled", "true");
    try {
      await deleteStaffVideo(videoId, videoPath);
      staffVideosCache = staffVideosCache.filter((video) => String(video.id) !== String(videoId));
      renderStaffVideosList(staffVideosCache);
      await renderVideosSection();
      setStatus("Video supprimée.", "success");
    } catch (error) {
      setStatus(error.message || "Suppression video impossible.", "error");
    } finally {
      deleteButton.removeAttribute("disabled");
    }
  });
}

if (communityGallery) {
  communityGallery.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const jumpButton = target.closest(".community-jump-comments");
    if (jumpButton instanceof HTMLElement) {
      const card = jumpButton.closest(".community-card");
      const comments = card?.querySelector(".community-comment-form");
      if (comments instanceof HTMLElement) {
        comments.scrollIntoView({ behavior: "smooth", block: "center" });
        const textarea = comments.querySelector("textarea");
        if (textarea instanceof HTMLTextAreaElement) {
          textarea.focus();
        }
      }
    }
  });

  communityGallery.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const likeButton = target.closest(".community-like");
    if (likeButton instanceof HTMLElement) {
      const submissionId = likeButton.getAttribute("data-submission-id");
      if (!submissionId || !currentPseudo) {
        return;
      }

      const liked = likeButton.getAttribute("data-liked") === "true";
      likeButton.disabled = true;

      try {
        if (liked) {
          const { error } = await supabaseClient
            .from("submission_likes")
            .delete()
            .eq("submission_id", submissionId)
            .eq("pseudo", currentPseudo);
          if (error) {
            throw new Error(error.message || "Suppression du like impossible");
          }
        } else {
          const { error } = await supabaseClient.from("submission_likes").insert([
            {
              submission_id: submissionId,
              pseudo: currentPseudo
            }
          ]);
          if (error) {
            throw new Error(error.message || "Ajout du like impossible");
          }
        }
        await renderCommunityGallery();
      } catch (error) {
        setStatus(error.message || "Erreur pendant le like.", "error");
      } finally {
        likeButton.disabled = false;
      }
    }
  });

  communityGallery.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches(".community-comment-form")) {
      return;
    }

    event.preventDefault();

    const submissionId = form.getAttribute("data-submission-id");
    const textarea = form.querySelector("textarea[name='comment']");
    const body = textarea ? textarea.value.trim() : "";
    if (!submissionId || !body || !currentPseudo) {
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = true;
    }

    try {
      const { error } = await supabaseClient.from("submission_comments").insert([
        {
          submission_id: submissionId,
          pseudo: currentPseudo,
          body
        }
      ]);
      if (error) {
        throw new Error(error.message || "Ajout du commentaire impossible");
      }
      form.reset();
      await renderCommunityGallery();
    } catch (error) {
      setStatus(error.message || "Erreur pendant le commentaire.", "error");
    } finally {
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = false;
      }
    }
  });
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
