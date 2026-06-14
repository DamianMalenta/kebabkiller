# 04. Model kosztów — jak to ma kosztować ~0 zł

**Cel (W6):** minimalny koszt. Zasada: **audyt = darmowy zawsze**, **rozumowanie LLM = darmowe tiery
+ lokalny fallback**, **hosting = jeden mały/„always-free" host**.

> Ceny/limity: stan z researchu czerwiec 2026 ([02](02_BADANIE_ROZWIAZAN.md)). Zweryfikuj przed wdrożeniem.

---

## 1. Audyty plików — 0 zł (zawsze)

Audyt to czysty kod (`ripgrep`, tree-sitter, ESLint/Ruff, gitleaks, `npm audit`). Nie woła LLM.
→ Nieograniczona liczba audytów, także offline. To rdzeń „darmowego mistrza audytów".

## 2. LLM — darmowe tiery + bramka z failoverem

LLM potrzebny tylko do rozumowania/pisania kodu. Stos darmowy:

| Priorytet | Dostawca | Darmowy limit (≈) | Rola |
|-----------|----------|-------------------|------|
| 1 | **Groq** | 14 400 req/dzień | Szybkie, główny koń roboczy |
| 2 | **Gemini API** | 1 500 req/dzień (Flash) | Backup + dłuższy kontekst |
| 3 | **OpenRouter `:free`** | 50–1000 req/dzień | Modele do kodu (Qwen3-Coder, DeepSeek) |
| 4 | **Ollama (lokalnie)** | bez limitu | Fallback gdy tiery padną / offline / prywatność |

**Bramka LLM** (failover, quota-aware, circuit breaker) łączy to w jeden endpoint — Symbiont „nie widzi
429". Gotowce do użycia/wzorowania: FreeLLM, Freeloader (open-source).

**Kiedy może pojawić się koszt:** tylko jeśli świadomie włączysz model płatny (np. Claude/GPT do
trudnego zadania). Wtedy płacisz per token, ale to opcja, nie wymóg.

## 3. Hosting Rdzenia — 1 mały host

„Mózg" stoi **raz** (W5). Opcje od najtańszej:

| Opcja | Koszt | Uwagi |
|-------|-------|-------|
| **Własny komputer / Raspberry Pi w domu** + Cloudflare Tunnel/Tailscale | ~0 zł | Prąd + już masz sprzęt; dostęp z świata przez tunel |
| **Darmowy tier chmury** (np. Oracle Always Free, fly.io free, itp.) | 0 zł | Limity zasobów; dobre na MVP |
| **Mały VPS** (1 vCPU, 1–2 GB RAM) | ~kilka–kilkanaście zł/mies. | Stabilne, proste, zalecane gdy chcesz „postaw i zapomnij" |

MVP (audyt read-only) jest lekkie — nie wymaga GPU ani ciężkiego Dockera. Sandbox/edycje można dołożyć,
gdy host na to pozwala.

## 4. Tor zmian / PR — 0 zł

Git, worktree, PR — darmowe (GitHub/GitLab free). CI na darmowych minutach (GitHub Actions free tier).

---

## Szacunkowy rachunek miesięczny

| Scenariusz | Koszt/mies. |
|------------|-------------|
| Audyty + LLM na darmowych tierach + host w domu (tunel) | **~0 zł** (prąd) |
| Jw. ale na małym VPS | **~kilka–kilkanaście zł** |
| Dołożony model płatny do trudnych zadań (opcjonalnie) | + per token (kontrolowane) |

---

## Strażnik kosztów (wbudowany)

Aby koszt nie „uciekł", Rdzeń ma prosty **strażnik**:
- domyślnie **tylko darmowe modele**; płatny wymaga jawnego włączenia per zadanie,
- licznik zużycia tierów + alert przy zbliżaniu się do limitu,
- audyt nigdy nie woła LLM (twarda reguła),
- limit długości kontekstu / liczby kroków agenta na run.
