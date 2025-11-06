# Como alterar o nome e logo do app Android

## ✅ Nome alterado para "Volumosos BC"

Os arquivos foram atualizados:
- `capacitor.config.ts` → `appName: 'Volumosos BC'`
- `android/app/src/main/res/values/strings.xml` → `<string name="app_name">Volumosos BC</string>`

---

## 🎨 Alterar o ícone/logo do app

### Método 1: Gerador online (mais fácil)

1. **Crie um ícone quadrado 1024x1024px** (PNG com fundo transparente ou sólido).
   - Use Canva, Figma, ou qualquer editor de imagens.
   - Exemplo: logo da Ambiental com fundo verde ou transparente.

2. **Gere os ícones adaptativos** usando uma ferramenta online:
   - **Icon Kitchen** (Recomendado): https://icon.kitchen/
     - Upload da imagem 1024x1024.
     - Escolha "Adaptive & Legacy" (para compatibilidade Android 5+).
     - Ajuste padding e cor de fundo se necessário.
     - Clique em "Download" → salva um ZIP com todas as densidades.
   
   - Alternativa: **Android Asset Studio**: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html

3. **Extraia o ZIP** e substitua os arquivos em:
   ```
   android/app/src/main/res/
   ├── mipmap-mdpi/
   ├── mipmap-hdpi/
   ├── mipmap-xhdpi/
   ├── mipmap-xxhdpi/
   ├── mipmap-xxxhdpi/
   └── mipmap-anydpi-v26/
   ```
   
   Mantenha os nomes originais:
   - `ic_launcher.png`
   - `ic_launcher_round.png`
   - `ic_launcher_foreground.png` (camada frontal do ícone adaptativo)

4. **(Opcional) Cor de fundo do ícone adaptativo:**
   Edite `android/app/src/main/res/values/ic_launcher_background.xml`:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <resources>
       <color name="ic_launcher_background">#008577</color>  <!-- Verde Ambiental -->
   </resources>
   ```

---

### Método 2: Capacitor Assets (CLI - automático)

Se você tiver o **@capacitor/assets** (plugin oficial):

```powershell
npm install @capacitor/assets --save-dev
```

1. Crie uma pasta `resources/` na raiz do projeto:
   ```
   volumosos/
   └── resources/
       └── icon.png    (1024x1024px)
   ```

2. Execute:
   ```powershell
   npx capacitor-assets generate --iconBackgroundColor '#008577' --iconBackgroundColorDark '#008577'
   ```

3. Os ícones serão gerados automaticamente em todas as densidades.

---

### Método 3: Manual (trabalhoso)

Se preferir criar manualmente, você precisa de 18 variações do ícone:

| Pasta | Tamanho |
|-------|---------|
| mipmap-mdpi | 48x48 |
| mipmap-hdpi | 72x72 |
| mipmap-xhdpi | 96x96 |
| mipmap-xxhdpi | 144x144 |
| mipmap-xxxhdpi | 192x192 |

Para cada pasta:
- `ic_launcher.png` (ícone quadrado)
- `ic_launcher_round.png` (ícone redondo)
- `ic_launcher_foreground.png` (camada frontal, para adaptive icons)

---

## 🔄 Aplicar as mudanças

Após alterar nome e ícones:

```powershell
# Sincronizar com o projeto Android
npx cap sync android

# (Opcional) Se já tinha instalado, limpe cache do Android
cd android
.\gradlew clean
cd ..

# Rebuild e instale
npm run android:sync
```

No Android Studio:
- Build > Clean Project
- Run (▶)

O app aparecerá com o novo nome e ícone no emulador/celular.

---

## 📦 Gerar APK final com novo nome/logo

```powershell
cd android
.\gradlew assembleRelease
```

O APK estará em:
```
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

Para assinar (produção), você precisará de uma keystore. Posso te ajudar com isso depois se quiser.

---

## Resumo rápido

1. ✅ Nome alterado para "Volumosos BC".
2. Para o logo:
   - Use https://icon.kitchen/ para gerar todos os ícones.
   - Substitua os arquivos em `android/app/src/main/res/mipmap-*/`.
   - Execute `npx cap sync android`.
   - Rode o app e veja o novo ícone.

Me avise se precisar de ajuda para criar/aplicar o ícone!
