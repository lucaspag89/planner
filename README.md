# Meu Controle Financeiro

Site de controle financeiro pessoal, inspirado no app Grão Planejamento.
Tudo em **HTML/CSS/JS puro** no front-end (hospedado de graça no **GitHub Pages**)
conectado a um **banco de dados Postgres** com API e login prontos no **Supabase**
(plano gratuito). **Custo total: R$ 0,00.**

## O que ele faz

- **Login/cadastro** por e-mail e senha (cada usuário vê só os próprios dados).
- **Home**: indicador de saúde financeira (gauge), patrimônio líquido, entradas/saídas do mês.
- **Lançamentos**: lista de receitas/despesas, cadastro manual e **importação de extrato em CSV**.
- **Plano**: orçamento mensal por categoria (gasto x meta) com gráfico de barras.
- **Patrimônio**: ativos, passivos, patrimônio líquido e % de ativos que geram renda (gráfico de rosca).
- **Investimentos**: carteira por produto/classe com alocação.
- **Contas**: contas correntes e cartões com limite usado/disponível.

---

## Como a arquitetura funciona

```
[ Navegador / GitHub Pages ]  --HTTPS-->  [ Supabase: API REST + Auth + Postgres ]
        index.html + app.js                    (faz o papel de "servidor + banco")
```

O GitHub Pages só serve arquivos estáticos (não roda servidor), então quem faz o
papel de servidor + banco é o Supabase. O `app.js` fala direto com ele via HTTPS.
A chave `anon` pode ficar pública com segurança porque o acesso é restringido pelo
**RLS (Row Level Security)** definido em `db/schema.sql`.

---

## Passo a passo (15 minutos)

### 1. Criar o banco no Supabase
1. Acesse https://supabase.com e crie uma conta gratuita.
2. Clique em **New project**, dê um nome e uma senha ao banco, escolha a região
   (ex: South America) e aguarde criar (~2 min).
3. No menu lateral abra **SQL Editor → New query**.
4. Abra o arquivo `db/schema.sql` deste projeto, copie **todo** o conteúdo, cole e
   clique em **Run**. Isso cria as tabelas e a segurança por usuário.

### 2. Pegar as chaves de conexão
1. No Supabase vá em **Settings (engrenagem) → API** (ou **Data API**).
2. Copie o **Project URL** e a chave **anon public**.
3. Abra `js/config.js` e cole nos lugares indicados:
   ```js
   window.SUPABASE_URL = "https://xxxx.supabase.co";
   window.SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```

### 3. (Opcional) Facilitar o teste de login
Por padrão o Supabase pede confirmação de e-mail no cadastro. Para testar mais
rápido: **Authentication → Providers → Email** e desligue **"Confirm email"**.
(Em uso real, deixe ligado.)

### 4. Publicar no GitHub Pages
1. Crie um repositório novo no GitHub (ex: `controle-financeiro`).
2. Suba **todos os arquivos desta pasta** para o repositório (raiz do repo).
   - Pelo site: botão **Add file → Upload files**, arraste os arquivos e dê commit.
   - Ou por linha de comando:
     ```bash
     git init
     git add .
     git commit -m "Controle financeiro"
     git branch -M main
     git remote add origin https://github.com/SEU_USUARIO/controle-financeiro.git
     git push -u origin main
     ```
3. No repositório: **Settings → Pages**.
4. Em **Source** escolha **Deploy from a branch**, selecione a branch `main` e a
   pasta `/ (root)`, e salve.
5. Aguarde ~1 min. O site ficará em:
   `https://SEU_USUARIO.github.io/controle-financeiro/`

### 5. Liberar o domínio no Supabase (recomendado)
Em **Authentication → URL Configuration**, adicione a URL do GitHub Pages em
**Site URL** / **Redirect URLs** para o login funcionar sem avisos.

---

## Como usar

1. Abra o site, clique em **Criar conta** e cadastre-se.
2. Faça login.
3. Na tela **Lançamentos**, clique em **Carregar dados de exemplo** para ver tudo
   funcionando, ou:
   - **+ Novo lançamento** para cadastrar manualmente, ou
   - **Importar extrato (CSV)** para importar vários de uma vez.

### Formato do CSV
Use o arquivo `exemplo-extrato.csv` como modelo. Colunas aceitas (em qualquer ordem):

| Coluna | Obrigatória | Observação |
|---|---|---|
| `data` | sim | `dd/mm/aaaa` ou `aaaa-mm-dd` |
| `valor` | sim | aceita `1.234,56` ou `1234.56` |
| `estabelecimento` ou `descrição` | não | nome do lançamento |
| `categoria` | não | se vazio, vira "Outros" |
| `meio de pagamento` | não | conta/cartão |
| `tipo` | não | `entrada`/`saida`. Se faltar, valor positivo = entrada |

---

## Estrutura dos arquivos

```
financas/
├── index.html            # estrutura da página (login + app)
├── css/style.css         # estilo
├── js/
│   ├── config.js         # <- cole aqui URL e chave do Supabase
│   └── app.js            # toda a lógica das telas
├── db/schema.sql         # rode no SQL Editor do Supabase
├── exemplo-extrato.csv   # modelo de importação
└── README.md
```

## Limites do plano gratuito
- Supabase free: 500 MB de banco e 50.000 usuários ativos/mês — sobra muito para uso pessoal.
- GitHub Pages: ilimitado para sites públicos.

## Segurança
Nunca use a chave **service_role** no front-end (ela ignora o RLS). Use só a **anon**.
Os dados ficam protegidos pelas políticas de RLS criadas no `schema.sql`.
