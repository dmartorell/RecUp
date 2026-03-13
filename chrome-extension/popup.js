const PASSWORD = '1234';

const views = {
  login: document.getElementById('view-login'),
  idle: document.getElementById('view-idle'),
};

const els = {
  email: document.getElementById('login-email'),
  password: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  btnLogin: document.getElementById('btn-login'),
  btnLogout: document.getElementById('btn-logout'),
  userEmail: document.getElementById('user-email'),
};

function showLogin() {
  views.idle.classList.add('hidden');
  views.login.classList.remove('hidden');
  els.email.value = '';
  els.password.value = '';
  els.loginError.classList.add('hidden');
}

function showIdle(email) {
  views.login.classList.add('hidden');
  views.idle.classList.remove('hidden');
  els.userEmail.textContent = email;
}

function handleLogin() {
  const email = els.email.value.trim();
  const password = els.password.value;

  if (!email) {
    els.loginError.textContent = 'Introduce tu email.';
    els.loginError.classList.remove('hidden');
    return;
  }

  if (password !== PASSWORD) {
    els.loginError.textContent = 'Credenciales incorrectas.';
    els.loginError.classList.remove('hidden');
    return;
  }

  chrome.storage.local.set({ bugshot_token: 'local', bugshot_email: email }, () => {
    showIdle(email);
  });
}

function handleLogout() {
  chrome.storage.local.remove(['bugshot_token', 'bugshot_email'], () => {
    showLogin();
  });
}

els.btnLogin.addEventListener('click', handleLogin);
els.btnLogout.addEventListener('click', handleLogout);

els.password.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});

chrome.storage.local.get(['bugshot_token', 'bugshot_email'], (result) => {
  if (result.bugshot_token && result.bugshot_email) {
    showIdle(result.bugshot_email);
  } else {
    showLogin();
  }
});
