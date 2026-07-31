# Charme de Mulher — site

Site já conectado ao banco de dados (Supabase). Falta só publicar.

## Publicar de graça na Vercel (sem instalar nada no computador)

1. Crie uma conta gratuita em **github.com**
2. Clique em **New repository**, dê um nome (ex: `charme-de-mulher`) e crie (pode deixar "Public")
3. Dentro do repositório vazio, clique em **"uploading an existing file"**
4. Arraste **todos os arquivos e pastas de dentro desta pasta** (não a pasta em si) para a janela do navegador
5. Clique em **Commit changes** no final da página

6. Crie uma conta gratuita em **vercel.com** (pode entrar direto com sua conta do GitHub)
7. Clique em **Add New... → Project**
8. Selecione o repositório `charme-de-mulher` que você acabou de criar → **Import**
9. A Vercel já reconhece que é um projeto Vite/React automaticamente — não precisa mudar nada, é só clicar em **Deploy**
10. Em cerca de 1 minuto, ela te dá o link do site no ar, algo como `charme-de-mulher.vercel.app`

Pronto — o site está publicado e já usando o banco de dados real. Toda vez que você (ou eu) alterar o código e subir de novo no GitHub, a Vercel atualiza o site sozinha.

## Quando quiser usar um domínio próprio (ex: charmedemulher.com.br)
Dentro do projeto na Vercel: **Settings → Domains → Add**, e seguir as instruções para apontar o domínio comprado no registrador (Registro.br, Hostinger, etc.).
