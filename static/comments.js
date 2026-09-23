(() => {
  const root = document.querySelector("[data-comments]");
  if (!root) return;

  const url = root.dataset.supabaseUrl;
  const key = root.dataset.supabaseKey;
  const pagePath = root.dataset.pagePath || window.location.pathname;

  if (!window.supabase || !url || !key) return;

  const client = window.supabase.createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  const loginBox = root.querySelector("[data-comments-login]");
  const userBox = root.querySelector("[data-comments-user]");
  const userName = root.querySelector("[data-comments-user-name]");
  const form = root.querySelector("[data-comments-form]");
  const textarea = root.querySelector("textarea");
  const list = root.querySelector("[data-comments-list]");
  const status = root.querySelector("[data-comments-status]");
  const loginButton = root.querySelector("[data-google-login]");
  const logoutButton = root.querySelector("[data-google-logout]");

  let currentUser = null;

  function setStatus(message, isError = false) {
    status.textContent = message || "";
    status.classList.toggle("is-error", isError);
  }

  function escapeText(value) {
    return String(value ?? "");
  }

  function initials(name) {
    const text = escapeText(name).trim();
    return text ? text.slice(0, 1).toUpperCase() : "?";
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(value));
    } catch {
      return "";
    }
  }

  function renderComment(comment) {
    const item = document.createElement("article");
    item.className = "comment-item";

    const header = document.createElement("div");
    header.className = "comment-header";

    const avatar = document.createElement("span");
    avatar.className = "comment-avatar";
    avatar.textContent = initials(comment.display_name);

    const author = document.createElement("div");
    author.className = "comment-author";

    const name = document.createElement("strong");
    name.textContent = escapeText(comment.display_name);

    const date = document.createElement("time");
    date.dateTime = comment.created_at;
    date.textContent = formatDate(comment.created_at);

    author.append(name, date);
    header.append(avatar, author);

    const body = document.createElement("div");
    body.className = "comment-body";
    body.textContent = escapeText(comment.content);

    item.append(header, body);

    if (comment.status === "pending") {
      const pending = document.createElement("div");
      pending.className = "comment-pending";
      pending.textContent = "待审核";
      item.append(pending);
    }

    return item;
  }

  async function loadComments() {
    list.replaceChildren();

    const { data, error } = await client
      .from("comments")
      .select("id, user_id, display_name, content, status, created_at")
      .eq("page_path", pagePath)
      .order("created_at", { ascending: true });

    if (error) {
      setStatus("留言暂时无法加载，请稍后再试。", true);
      return;
    }

    if (!data || data.length === 0) {
      const empty = document.createElement("p");
      empty.className = "comments-empty";
      empty.textContent = "还没有留言。";
      list.append(empty);
      return;
    }

    data.forEach((comment) => {
      if (comment.status === "approved" || (currentUser && comment.user_id === currentUser.id)) {
        list.append(renderComment(comment));
      }
    });
  }

  function updateAuthUI(user) {
    currentUser = user || null;

    if (currentUser) {
      loginBox.hidden = true;
      userBox.hidden = false;

      const metadata = currentUser.user_metadata || {};
      userName.textContent =
        metadata.full_name ||
        metadata.name ||
        currentUser.email?.split("@")[0] ||
        "Google 用户";
    } else {
      loginBox.hidden = false;
      userBox.hidden = true;
      userName.textContent = "";
    }

    loadComments();
  }

  loginButton.addEventListener("click", async () => {
    setStatus("正在跳转到 Google 登录……");

    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href
      }
    });

    if (error) {
      setStatus("Google 登录失败：" + error.message, true);
    }
  });

  logoutButton.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) {
      setStatus("退出登录失败：" + error.message, true);
      return;
    }
    setStatus("");
    updateAuthUI(null);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setStatus("请先使用 Google 登录。", true);
      return;
    }

    const content = textarea.value.trim();
    if (!content) {
      setStatus("留言内容不能为空。", true);
      return;
    }

    if (content.length > 2000) {
      setStatus("留言不能超过 2000 个字符。", true);
      return;
    }

    const metadata = currentUser.user_metadata || {};
    const displayName =
      metadata.full_name ||
      metadata.name ||
      currentUser.email?.split("@")[0] ||
      "Google 用户";

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    setStatus("正在提交……");

    const { error } = await client.from("comments").insert({
      page_path: pagePath,
      user_id: currentUser.id,
      display_name: displayName,
      content,
      status: "pending"
    });

    submitButton.disabled = false;

    if (error) {
      setStatus("提交失败：" + error.message, true);
      return;
    }

    textarea.value = "";
    setStatus("留言已提交，审核通过后会显示。");
    await loadComments();
  });

  client.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session?.user || null);
  });

  client.auth.getSession().then(({ data }) => {
    updateAuthUI(data.session?.user || null);
  });
})();
