/* Le registre ECI : interface autonome, aucun secret conservé dans le navigateur. */
(() => {
  "use strict";
  if (
    location.hostname.endsWith("github.io") ||
    location.hostname === "www.empire-contre-intox.com"
  ) {
    location.replace(
      "https://empire-contre-intox.com/empire-calendrier/admin/",
    );
    return;
  }
  const $ = (selector) => document.querySelector(selector);
  const state = {
    user: null,
    csrf: "",
    events: [],
    hosts: [],
    avatars: [],
    users: [],
    tab: "events",
  };
  let eventDraft = null,
    hostDraft = null,
    hostFromEvent = false,
    userDraft = null;
  let avatarTarget = null,
    avatarSelection = new Set(),
    cropImage = null,
    cropObjectURL = null;
  let busyCount = 0,
    uploadBusy = false;
  const monthInput = $("#month-filter");
  monthInput.value = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
  const node = (tag, cls, content) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (content !== undefined) el.textContent = content;
    return el;
  };
  const buttons = (text, action, cls = "quiet") => {
    const el = node("button", cls, text);
    el.type = "button";
    el.addEventListener("click", () => run(action));
    return el;
  };
  const safeURL = (value) => {
    try {
      const u = new URL(value, location.href);
      return ["https:", "http:"].includes(u.protocol) ? u.href : "";
    } catch {
      return "";
    }
  };
  const initials = (name) =>
    (name || "ECI")
      .split(/[\s&]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  const key = (value) =>
    String(value || "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  function status(message = "", type = "") {
    $("#status").textContent = message;
    $("#status").className = `notice ${type}`;
  }
  function message(dialog, error = "") {
    $(dialog).querySelector("[data-error]").textContent = error;
  }
  async function run(action) {
    try {
      await action();
    } catch (error) {
      status(error.message || "Impossible de terminer l’action.", "error");
    }
  }
  async function api(path, options = {}) {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    if (options.method && options.method !== "GET")
      headers.set("X-CSRF-Token", state.csrf);
    const response = await fetch(`/api/calendar${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Le service calendrier est indisponible. Réessayez plus tard.",
      );
    }
    if (!response.ok) {
      if (response.status === 401 && path !== "/login") showLogin();
      const error = new Error(data.error || "Enregistrement impossible.");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function showLogin() {
    window.dispatchEvent(new CustomEvent("eci-calendar-session", {detail:null}));
    state.user = null;
    state.csrf = "";
    state.events = [];
    state.hosts = [];
    state.avatars = [];
    state.users = [];
    for (const dialog of document.querySelectorAll("dialog[open]"))
      dialog.close();
    $("#workspace").hidden = true;
    $("#session-bar").hidden = true;
    $("#login-panel").hidden = false;
  }
  async function load() {
    const next = await api("/state");
    Object.assign(state, next);
    render();
    if (state.user.role === "admin") {
      state.users = await api("/users");
      renderUsers();
    }
  }
  async function enter(session) {
    state.user = session.user;
    state.csrf = session.csrf;
    window.dispatchEvent(new CustomEvent("eci-calendar-session", {detail:session}));
    $("#login-panel").hidden = true;
    $("#session-bar").hidden = false;
    $("#session-name").textContent = state.user.displayName || state.user.login;
    $("#users-tab").hidden = state.user.role !== "admin";
    if (state.user.mustChange) {
      $("#workspace").hidden = true;
      $("#password-explanation").textContent =
        "Choisissez votre propre mot de passe avant d’ouvrir le registre. Vous devrez ensuite vous reconnecter.";
      $("#password-close").hidden = true;
      $("#password-form").reset();
      $("#password-dialog").showModal();
      status();
      return;
    }
    $("#workspace").hidden = false;
    await load();
    status();
  }
  function portrait(id, name = "") {
    const avatar = state.avatars.find((a) => a.id === id),
      url = avatar && safeURL(avatar.url);
    if (!url) return node("span", "portrait", initials(name));
    const img = node("img", "portrait");
    img.src = url;
    img.alt = avatar.label || name;
    img.loading = "lazy";
    img.addEventListener(
      "error",
      () => img.replaceWith(node("span", "portrait", initials(name))),
      { once: true },
    );
    return img;
  }
  function portraits(ids, name = "") {
    const wrap = node("span", "portraits");
    for (const id of ids.slice(0, 8)) wrap.append(portrait(id, name));
    if (!ids.length) wrap.append(portrait(null, name));
    return wrap;
  }
  function eventHosts(ev) {
    return ev.hostIds
      .map((id) => state.hosts.find((h) => h.id === id))
      .filter(Boolean);
  }
  function eventAvatars(ev) {
    return ev.avatarIds.length
      ? ev.avatarIds
      : [...new Set(eventHosts(ev).flatMap((h) => h.avatarIds))];
  }
  function render() {
    renderEvents();
    renderHosts();
    $("#event-count").textContent = state.events.filter(
      (e) => !e.deleted,
    ).length;
    $("#host-count").textContent = state.hosts.length;
  }
  function renderEvents() {
    const container = $("#event-list");
    container.replaceChildren();
    const search = key($("#event-search").value),
      trash = $("#trash-filter").checked;
    const values = state.events
      .filter(
        (e) =>
          e.deleted === trash &&
          (!monthInput.value || e.date.startsWith(monthInput.value)) &&
          key(
            `${e.title} ${eventHosts(e)
              .map((h) => h.name)
              .join(" ")}`,
          ).includes(search),
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.time.localeCompare(b.time, undefined, { numeric: true }),
      );
    if (!values.length) {
      const empty = node("div", "empty-state");
      empty.append(
        node(
          "h2",
          "",
          trash ? "La corbeille est vide." : "Un mois à faire vivre.",
        ),
        node(
          "p",
          "",
          trash
            ? "Les rendez-vous supprimés apparaîtront ici."
            : "Aucun rendez-vous ne correspond à cette recherche.",
        ),
      );
      if (!trash)
        empty.append(
          buttons("+ Programmer un live", () => openEvent(), "primary"),
        );
      container.append(empty);
      return;
    }
    for (const event of values) {
      const row = node("article", "event-row"),
        date = node("div");
      date.append(node("strong", "event-day", Number(event.date.slice(8))));
      date.append(
        node(
          "span",
          "event-weekday",
          new Intl.DateTimeFormat("fr-FR", {
            weekday: "short",
            month: "short",
            timeZone: "Europe/Paris",
          }).format(new Date(`${event.date}T12:00:00Z`)),
        ),
      );
      const content = node("div");
      content.append(node("h2", "event-title", event.title));
      const names = eventHosts(event)
        .map((h) => h.name)
        .join(" & ");
      const hosts = node("div", "event-hosts");
      hosts.append(
        portraits(eventAvatars(event), names || event.title),
        node("span", "", names || "Collectif ECI"),
      );
      content.append(hosts);
      const actions = node("div", "row-actions");
      if (!trash)
        actions.append(buttons("Modifier", () => openEvent(event), "outline"));
      actions.append(
        buttons(trash ? "Restaurer…" : "Historique", () => openHistory(event)),
      );
      row.append(date, node("div", "event-time", event.time), content, actions);
      container.append(row);
    }
  }
  function renderHosts() {
    const container = $("#host-list");
    container.replaceChildren();
    const search = key($("#host-search").value);
    for (const host of state.hosts.filter((h) =>
      key(h.name).includes(search),
    )) {
      const card = node("article", "host-card");
      card.append(
        portraits(host.avatarIds, host.name),
        node("h3", "", host.name),
      );
      const actions = node("div", "row-actions");
      actions.append(
        buttons("Modifier", () => openHost(host)),
        buttons(
          "Supprimer",
          async () => {
            if (
              !confirm(
                `Supprimer l’animateur « ${host.name} » ? Cette action est possible seulement s’il n’a jamais été utilisé.`,
              )
            )
              return;
            await api(`/hosts/${host.id}`, {
              method: "DELETE",
              body: JSON.stringify({ version: host.version }),
            });
            await load();
            status("Animateur supprimé.", "success");
          },
          "danger",
        ),
      );
      card.append(actions);
      container.append(card);
    }
    if (!container.childElementCount)
      container.append(node("p", "muted", "Aucun animateur trouvé."));
  }
  function renderUsers() {
    const container = $("#user-list");
    container.replaceChildren();
    for (const user of state.users) {
      const row = node("div", "user-row"),
        label = node("div");
      label.append(
        node("strong", "", user.displayName || user.login),
        node("span", "muted", ` (${user.login})`),
        document.createTextNode(" · "),
        node(
          "span",
          `badge ${user.active ? "" : "disabled"}`,
          user.active
            ? user.role === "admin"
              ? "Administrateur"
              : "Membre"
            : "Désactivé",
        ),
      );
      if (user.mustChange)
        label.append(
          node("p", "field-note", "Changement de mot de passe requis"),
        );
      row.append(
        label,
        buttons("Gérer le compte", () => openUser(user)),
      );
      container.append(row);
    }
  }
  function selectTab(name) {
    state.tab = name;
    for (const tab of document.querySelectorAll("[data-tab]")) {
      if (tab.dataset.tab === name) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    }
    for (const name2 of ["events", "hosts", "users", "lives"])
      $(`#${name2}-panel`).hidden = name !== name2;
  }
  function openEvent(event = null) {
    eventDraft = event
      ? structuredClone(event)
      : {
          id: null,
          version: null,
          date: `${monthInput.value || new Date().toISOString().slice(0, 7)}-01`,
          time: "22H00",
          title: "",
          note: "",
          url: "",
          hostIds: [],
          avatarIds: [],
          showHost: true,
        };
    $("#event-heading").textContent = event
      ? "Modifier le rendez-vous"
      : "Programmer un live";
    const form = $("#event-form");
    form.reset();
    for (const name of ["title", "date", "time", "note", "url"])
      form.elements[name].value = eventDraft[name];
    $("#event-delete").hidden = !event;
    $("#event-host-search").value = "";
    renderEventHostChoices();
    $("#event-hosts").scrollTop = 0;
    renderEventPortraits();
    message("#event-dialog");
    $("#event-dialog").showModal();
  }
  function renderEventHostChoices() {
    const container = $("#event-hosts");
    container.replaceChildren();
    const search = key($("#event-host-search").value);
    const hosts = [...state.hosts].sort(
      (a, b) =>
        Number(eventDraft.hostIds.includes(b.id)) -
          Number(eventDraft.hostIds.includes(a.id)) ||
        a.name.localeCompare(b.name, "fr"),
    );
    for (const host of hosts.filter((h) => key(h.name).includes(search))) {
      const label = node("label", "host-choice"),
        input = node("input");
      input.type = "checkbox";
      input.value = host.id;
      input.checked = eventDraft.hostIds.includes(host.id);
      input.addEventListener("change", () => {
        if (input.checked) {
          if (eventDraft.hostIds.length >= 8) {
            input.checked = false;
            message(
              "#event-dialog",
              "Vous pouvez sélectionner jusqu’à huit animateurs.",
            );
            return;
          }
          eventDraft.hostIds.push(host.id);
        } else
          eventDraft.hostIds = eventDraft.hostIds.filter(
            (id) => id !== host.id,
          );
        renderEventPortraits();
      });
      label.append(
        input,
        portraits(host.avatarIds, host.name),
        node("span", "", host.name),
      );
      container.append(label);
    }
    if (!container.childElementCount)
      container.append(
        node(
          "p",
          "field-note",
          "Aucun résultat. Vous pouvez créer un animateur ci-dessous.",
        ),
      );
  }
  function preview(container, ids, name) {
    container.replaceChildren(portraits(ids, name));
  }
  function renderEventPortraits() {
    preview(
      $("#event-avatar-preview"),
      eventAvatars(eventDraft),
      eventHosts(eventDraft)
        .map((h) => h.name)
        .join(" "),
    );
    $("#event-avatar-mode").textContent = eventDraft.avatarIds.length
      ? "Portraits choisis pour ce rendez-vous uniquement."
      : "Portraits des animateurs sélectionnés.";
  }
  function openHost(host = null, fromEvent = false) {
    hostFromEvent = fromEvent;
    hostDraft = host
      ? structuredClone(host)
      : { id: null, name: "", avatarIds: [] };
    $("#host-heading").textContent = host
      ? "Modifier l’animateur"
      : "Créer un animateur";
    $("#host-form").reset();
    $("#host-form").elements.name.value = hostDraft.name;
    preview($("#host-avatar-preview"), hostDraft.avatarIds, hostDraft.name);
    $("#host-duplicates").textContent = "";
    message("#host-dialog");
    $("#host-dialog").showModal();
  }
  function openAvatars(target) {
    avatarTarget = target;
    const ids = target === "host" ? hostDraft.avatarIds : eventDraft.avatarIds;
    avatarSelection = new Set(ids);
    $("#avatar-search").value = "";
    $("#avatar-error").textContent = "";
    resetCrop();
    renderGallery();
    $("#avatar-dialog").showModal();
  }
  function renderGallery() {
    const gallery = $("#avatar-gallery");
    gallery.replaceChildren();
    const search = key($("#avatar-search").value);
    for (const avatar of state.avatars.filter((a) =>
      key(a.label).includes(search),
    )) {
      const label = node("label", "avatar-choice"),
        input = node("input");
      input.type = "checkbox";
      input.checked = avatarSelection.has(avatar.id);
      input.addEventListener("change", () => {
        if (input.checked) {
          if (avatarSelection.size >= 8) {
            input.checked = false;
            $("#avatar-error").textContent =
              "Vous pouvez sélectionner jusqu’à huit portraits.";
            return;
          }
          avatarSelection.add(avatar.id);
        } else avatarSelection.delete(avatar.id);
        selectionCount();
      });
      label.append(input, portrait(avatar.id), node("span", "", avatar.label));
      gallery.append(label);
    }
    if (!gallery.childElementCount)
      gallery.append(node("p", "field-note", "Aucun portrait trouvé."));
    selectionCount();
  }
  function selectionCount() {
    $("#avatar-selection-count").textContent =
      `${avatarSelection.size} portrait${avatarSelection.size > 1 ? "s" : ""} sélectionné${avatarSelection.size > 1 ? "s" : ""}`;
  }
  function resetCrop() {
    if (cropObjectURL) URL.revokeObjectURL(cropObjectURL);
    cropObjectURL = null;
    cropImage = null;
    $("#crop-panel").hidden = true;
    $("#avatar-file").value = "";
    for (const [id, value] of [
      ["crop-zoom", 1],
      ["crop-x", 50],
      ["crop-y", 50],
    ])
      $(`#${id}`).value = value;
    $("#avatar-label").value = "";
  }
  function drawCrop(canvas) {
    if (!cropImage) return;
    const zoom = Number($("#crop-zoom").value),
      side = Math.min(cropImage.naturalWidth, cropImage.naturalHeight) / zoom;
    const x =
        ((cropImage.naturalWidth - side) * Number($("#crop-x").value)) / 100,
      y = ((cropImage.naturalHeight - side) * Number($("#crop-y").value)) / 100;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      cropImage,
      x,
      y,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }
  async function chooseFile() {
    const file = $("#avatar-file").files[0];
    if (!file) return;
    $("#avatar-error").textContent = "";
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      resetCrop();
      throw new Error(
        "Choisissez une image JPEG, PNG ou WebP de 5 Mo maximum.",
      );
    }
    if (cropObjectURL) URL.revokeObjectURL(cropObjectURL);
    cropObjectURL = URL.createObjectURL(file);
    const url = cropObjectURL,
      image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Image illisible."));
      image.src = url;
    });
    if (cropObjectURL !== url) return;
    if (
      image.naturalWidth * image.naturalHeight > 16000000 ||
      image.naturalWidth > 8192 ||
      image.naturalHeight > 8192
    ) {
      resetCrop();
      throw new Error("Image trop grande : maximum 16 millions de pixels.");
    }
    cropImage = image;
    $("#crop-panel").hidden = false;
    $("#avatar-label").value =
      avatarTarget === "host"
        ? $("#host-form").elements.name.value
        : file.name.replace(/\.[^.]+$/, "").slice(0, 80);
    drawCrop($("#crop-canvas"));
  }
  async function upload() {
    if (!cropImage || uploadBusy) return;
    const title = $("#avatar-label").value.trim();
    if (!title) {
      $("#avatar-error").textContent = "Donnez un nom à ce portrait.";
      return;
    }
    uploadBusy = true;
    $("#avatar-upload").disabled = true;
    $("#avatar-apply").disabled = true;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      drawCrop(canvas);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.9),
      );
      if (!blob) throw new Error("Impossible de préparer l’image.");
      const form = new FormData();
      form.set("file", blob, "portrait.webp");
      form.set("label", title);
      const avatar = await api("/avatars", { method: "POST", body: form });
      if (!state.avatars.some((a) => a.id === avatar.id))
        state.avatars.push(avatar);
      if (avatarSelection.size < 8) avatarSelection.add(avatar.id);
      $("#avatar-search").value = "";
      resetCrop();
      renderGallery();
      status("Portrait importé dans la bibliothèque.", "success");
    } catch (error) {
      $("#avatar-error").textContent = error.message;
    } finally {
      uploadBusy = false;
      $("#avatar-upload").disabled = false;
      $("#avatar-apply").disabled = false;
    }
  }
  async function openHistory(event) {
    $("#history-list").replaceChildren(node("p", "muted", "Chargement…"));
    $("#history-error").textContent = "";
    $("#history-dialog").showModal();
    try {
      const versions = await api(`/events/${event.id}/history`);
      const list = $("#history-list");
      list.replaceChildren();
      for (const version of versions) {
        const item = node("article", "history-item");
        item.append(
          node(
            "strong",
            "",
            `${version.deleted ? "Suppression · " : ""}${version.data.title}`,
          ),
          node(
            "small",
            "",
            `${version.data.date} · ${version.data.time} · version ${version.version} · ${version.actor} · ${new Date(version.created_at.replace(" ", "T") + "Z").toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
          ),
        );
        if (!version.deleted)
          item.append(
            buttons(
              "Restaurer cette version",
              async () => {
                if (
                  !confirm(
                    "Restaurer cette version et la publier dans le calendrier ?",
                  )
                )
                  return;
                try {
                  await api(`/events/${event.id}/restore`, {
                    method: "POST",
                    body: JSON.stringify({
                      version: event.version,
                      historyId: version.id,
                    }),
                  });
                  $("#history-dialog").close();
                  await load();
                  status("Version restaurée et publiée.", "success");
                } catch (error) {
                  $("#history-error").textContent = error.message;
                }
              },
              "outline",
            ),
          );
        list.append(item);
      }
    } catch (error) {
      $("#history-error").textContent = error.message;
    }
  }
  function openUser(user = null) {
    userDraft = user
      ? structuredClone(user)
      : { id: null, login: "", displayName: "", role: "user", active: true };
    const form = $("#user-form");
    form.reset();
    form.elements.login.value = userDraft.login;
    form.elements.login.disabled = !!user;
    form.elements.displayName.value = userDraft.displayName || userDraft.login;
    form.elements.role.value = userDraft.role;
    form.elements.active.checked = userDraft.active;
    form.elements.password.required = !user;
    $("#user-heading").textContent = user
      ? `Compte de ${user.login}`
      : "Créer un compte";
    message("#user-dialog");
    $("#user-dialog").showModal();
  }
  async function submit(form, dialog, action) {
    if (form.dataset.busy) return;
    form.dataset.busy = "1";
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    busyCount++;
    message(dialog);
    try {
      await action();
    } catch (error) {
      message(dialog, error.message);
      if (error.status === 409) {
        await load();
        message(
          dialog,
          `${error.message}\nVotre saisie est conservée. Fermez puis rouvrez le formulaire pour repartir de la dernière version.`,
        );
      }
    } finally {
      delete form.dataset.busy;
      submit.disabled = false;
      busyCount--;
    }
  }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      button = form.querySelector("button");
    button.disabled = true;
    try {
      const data = await api("/login", {
        method: "POST",
        body: JSON.stringify({
          login: form.elements.login.value,
          password: form.elements.password.value,
        }),
      });
      form.elements.password.value = "";
      await enter(data);
    } catch (error) {
      status(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
  $("#event-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    submit(form, "#event-dialog", async () => {
      const data = {
        ...eventDraft,
        ...Object.fromEntries(new FormData(form)),
        showHost: true,
      };
      await api(eventDraft.id ? `/events/${eventDraft.id}` : "/events", {
        method: eventDraft.id ? "PUT" : "POST",
        body: JSON.stringify(data),
      });
      $("#event-dialog").close();
      await load();
      status("Rendez-vous enregistré et publié.", "success");
    });
  });
  $("#host-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    submit(form, "#host-dialog", async () => {
      const host = await api(
        hostDraft.id ? `/hosts/${hostDraft.id}` : "/hosts",
        {
          method: hostDraft.id ? "PUT" : "POST",
          body: JSON.stringify({
            ...hostDraft,
            name: form.elements.name.value,
          }),
        },
      );
      state.hosts = state.hosts
        .filter((h) => h.id !== host.id)
        .concat(host)
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
      if (
        hostFromEvent &&
        eventDraft &&
        !eventDraft.hostIds.includes(host.id)
      ) {
        if (eventDraft.hostIds.length < 8) eventDraft.hostIds.push(host.id);
        else
          message(
            "#event-dialog",
            "Animateur créé. La sélection de cet événement contient déjà huit animateurs.",
          );
      }
      $("#host-dialog").close();
      render();
      if ($("#event-dialog").open) {
        renderEventHostChoices();
        renderEventPortraits();
      }
      status("Animateur enregistré.", "success");
    });
  });
  $("#user-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    submit(form, "#user-dialog", async () => {
      const data = {
        login: form.elements.login.value,
        displayName: form.elements.displayName.value,
        role: form.elements.role.value,
        active: form.elements.active.checked,
        password: form.elements.password.value,
      };
      await api(userDraft.id ? `/users/${userDraft.id}` : "/users", {
        method: userDraft.id ? "PUT" : "POST",
        body: JSON.stringify(data),
      });
      form.elements.password.value = "";
      $("#user-dialog").close();
      if (userDraft.id === state.user.id) {
        showLogin();
        status("Compte mis à jour. Reconnectez-vous.", "success");
      } else {
        await load();
        status(
          "Compte enregistré. Transmettez le mot de passe initial au membre.",
          "success",
        );
      }
    });
  });
  $("#password-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    submit(form, "#password-dialog", async () => {
      if (form.elements.password.value !== form.elements.confirm.value)
        throw new Error(
          "Les deux nouveaux mots de passe ne correspondent pas.",
        );
      await api("/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.elements.currentPassword.value,
          password: form.elements.password.value,
        }),
      });
      form.reset();
      showLogin();
      status("Mot de passe changé. Reconnectez-vous.", "success");
    });
  });
  $("#event-delete").addEventListener("click", () =>
    run(async () => {
      if (
        !eventDraft?.id ||
        !confirm(
          "Supprimer ce rendez-vous ? Il restera restaurable dans la corbeille.",
        )
      )
        return;
      try {
        await api(`/events/${eventDraft.id}`, {
          method: "DELETE",
          body: JSON.stringify({ version: eventDraft.version }),
        });
        $("#event-dialog").close();
        await load();
        status("Rendez-vous déplacé dans la corbeille.", "success");
      } catch (error) {
        message("#event-dialog", error.message);
      }
    }),
  );
  $("#event-new").addEventListener("click", () => openEvent());
  $("#host-new").addEventListener("click", () => openHost());
  $("#event-host-new").addEventListener("click", () => openHost(null, true));
  $("#user-new").addEventListener("click", () => openUser());
  $("#host-avatars").addEventListener("click", () => openAvatars("host"));
  $("#event-avatars").addEventListener("click", () => openAvatars("event"));
  $("#event-avatars-reset").addEventListener("click", () => {
    eventDraft.avatarIds = [];
    renderEventPortraits();
  });
  $("#avatar-apply").addEventListener("click", () => {
    const ids = [...avatarSelection];
    if (avatarTarget === "host") {
      hostDraft.avatarIds = ids;
      preview(
        $("#host-avatar-preview"),
        ids,
        $("#host-form").elements.name.value,
      );
    } else {
      eventDraft.avatarIds = ids;
      renderEventPortraits();
    }
    $("#avatar-dialog").close();
  });
  $("#avatar-file").addEventListener("change", () => {
    chooseFile().catch((error) => {
      $("#avatar-error").textContent = error.message;
    });
  });
  $("#avatar-upload").addEventListener("click", upload);
  for (const id of ["crop-zoom", "crop-x", "crop-y"])
    $(`#${id}`).addEventListener("input", () => drawCrop($("#crop-canvas")));
  $("#avatar-search").addEventListener("input", renderGallery);
  $("#event-host-search").addEventListener("input", renderEventHostChoices);
  $("#host-search").addEventListener("input", renderHosts);
  $("#host-form").elements.name.addEventListener("input", (e) => {
    const entered = key(e.target.value);
    const matches = entered
      ? state.hosts
          .filter(
            (h) =>
              h.id !== hostDraft.id &&
              (key(h.name).includes(entered) || entered.includes(key(h.name))),
          )
          .slice(0, 4)
      : [];
    $("#host-duplicates").textContent = matches.length
      ? `Déjà présents : ${matches.map((h) => h.name).join(", ")}`
      : "";
  });
  for (const selector of ["#month-filter", "#event-search", "#trash-filter"])
    $(selector).addEventListener("input", renderEvents);
  $("#refresh").addEventListener("click", () =>
    run(async () => {
      await load();
      status("Registre actualisé.", "success");
    }),
  );
  $("#logout").addEventListener("click", () =>
    run(async () => {
      await api("/logout", { method: "POST" });
      showLogin();
      status("Vous êtes déconnecté.");
    }),
  );
  $("#password-open").addEventListener("click", () => {
    $("#password-form").reset();
    message("#password-dialog");
    $("#password-close").hidden = false;
    $("#password-explanation").textContent =
      "Toutes vos sessions seront fermées après le changement.";
    $("#password-dialog").showModal();
  });
  $("#password-dialog").addEventListener("cancel", (e) => {
    if (state.user?.mustChange) e.preventDefault();
  });
  for (const tab of document.querySelectorAll("[data-tab]"))
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  for (const button of document.querySelectorAll("[data-close]"))
    button.addEventListener("click", () => {
      if (busyCount || uploadBusy) return;
      $("#" + button.dataset.close).close();
    });
  for (const dialog of document.querySelectorAll("dialog"))
    dialog.addEventListener("cancel", (e) => {
      if (busyCount || uploadBusy) e.preventDefault();
    });
  $("#avatar-dialog").addEventListener("close", resetCrop);
  window.addEventListener("beforeunload", (e) => {
    if (
      busyCount ||
      uploadBusy ||
      $("#event-dialog").open ||
      $("#host-dialog").open
    ) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  (async () => {
    try {
      await enter(await api("/session"));
    } catch (error) {
      showLogin();
      status(error.status === 401 ? "" : error.message, "error");
    }
  })();
})();
