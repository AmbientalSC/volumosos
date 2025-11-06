# Correção de CORS e Regras do Firebase

## Problema identificado
```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' 
from origin 'http://localhost:3000' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

O Firebase Storage por padrão **não permite** uploads de localhost ou domínios não autorizados. Você precisa:
1. Configurar CORS no bucket do Storage.
2. Ajustar as regras de segurança do Storage e Firestore.

---

## 1. Configurar CORS do Firebase Storage

### Opção A: Via Console do Firebase (Recomendado)
1. Acesse: https://console.firebase.google.com/project/volumosos-d6369/storage
2. Clique na aba "Regras" (Rules).
3. Substitua as regras atuais por:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{imageId} {
      // Permite leitura pública e escrita para usuários autenticados (incluindo anônimos)
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

4. Clique em "Publicar" (Publish).

### Opção B: Via gsutil (CLI do Google Cloud)
Se preferir usar linha de comando:

1. Instale o Google Cloud SDK: https://cloud.google.com/sdk/docs/install
2. Faça login:
   ```bash
   gcloud auth login
   ```
3. Crie um arquivo `cors.json` na raiz do projeto:
   ```json
   [
     {
       "origin": ["http://localhost:3000", "https://ambientalsc.github.io"],
       "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
4. Aplique a configuração CORS:
   ```bash
   gsutil cors set cors.json gs://volumosos-d6369.appspot.com
   ```
5. Verifique:
   ```bash
   gsutil cors get gs://volumosos-d6369.appspot.com
   ```

**Nota para Android:** O WebView do Capacitor não usa localhost; ele usa o esquema `https://localhost` ou `capacitor://`, então o CORS não afeta builds nativos. O erro acima é apenas para dev web.

---

## 2. Configurar Regras do Firestore

1. Acesse: https://console.firebase.google.com/project/volumosos-d6369/firestore/rules
2. Substitua as regras por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /records/{recordId} {
      // Leitura pública; escrita apenas para autenticados (incluindo anônimos)
      allow read: if true;
      allow write, delete: if request.auth != null;
    }
  }
}
```

3. Clique em "Publicar" (Publish).

---

## 3. Verificar autenticação anônima habilitada

1. Acesse: https://console.firebase.google.com/project/volumosos-d6369/authentication/providers
2. Clique em "Anônimo" (Anonymous).
3. Confirme que está **Ativado** (Enabled).

---

## 4. Testar novamente

Após aplicar as regras acima:

1. **Web (localhost:3000):**
   - Recarregue a página (Ctrl+Shift+R / Cmd+Shift+R).
   - Tente enviar uma foto.
   - O upload deve funcionar (sem erro CORS).

2. **Android (nativo):**
   - Execute `npm run android:sync` para rebuild e sincronizar.
   - Rode no Android Studio (Run ▶).
   - O app já deve enviar corretamente (CORS não afeta, mas as regras sim).

---

## Resumo da solução

| Componente | Ação | Onde |
|------------|------|------|
| **Storage CORS** | Liberar localhost:3000 e ambientalsc.github.io | Console Storage ou gsutil |
| **Storage Rules** | `allow read: if true; allow write: if request.auth != null;` | Console Storage > Regras |
| **Firestore Rules** | `allow read: if true; allow write, delete: if request.auth != null;` | Console Firestore > Regras |
| **Auth Anônimo** | Habilitar provedor Anonymous | Console Authentication > Providers |

---

## Referências
- CORS do Storage: https://firebase.google.com/docs/storage/web/download-files#cors_configuration
- Regras de segurança Storage: https://firebase.google.com/docs/storage/security
- Regras de segurança Firestore: https://firebase.google.com/docs/firestore/security/get-started
