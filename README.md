# Meu Controle Financeiro

Site de controle financeiro pessoal.
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

### 3. (Importante no modo senha única) Desligar confirmação de e-mail
Este app está no **modo de uso pessoal**: a tela pede só uma senha. Para a senha
ser cadastrada e já entrar de primeira, vá em **Authentication → Providers → Email**
e **desligue "Confirm email"**. Também deixe ligado **"Allow new users to sign up"**.

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

## Como usar (modo senha única)

1. Abra o site. A tela pede apenas uma **senha**.
2. Digite a senha que você quer usar (mín. 6 caracteres) e clique em **Entrar**.
   - **Na primeira vez**, essa senha é cadastrada automaticamente e você já entra.
   - **Nas próximas vezes**, basta digitar a mesma senha.
3. Na tela **Lançamentos**, clique em **Carregar dados de exemplo** para ver tudo
   funcionando, ou:
   - **+ Novo lançamento** para cadastrar manualmente, ou
   - **Importar extrato (CSV)** para importar vários de uma vez.

> O e-mail interno usado no login fica em `js/config.js` (`window.APP_LOGIN_EMAIL`)
> — não precisa ser um e-mail real, é só o identificador da sua conta. Para acessar
> de outro dispositivo, é só usar a mesma senha. Se esquecer a senha, dá para criar
> outra conta trocando o `APP_LOGIN_EMAIL`, ou redefinir a senha pelo painel do Supabase
> (Authentication → Users).

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
