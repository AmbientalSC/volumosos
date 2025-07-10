# Registro Fotográfico Geo

Um aplicativo para capturar fotos com sua localização, data e hora correspondentes. Ele lista todas as entradas e permite a geração de um relatório.

## 🌐 Demo Online

Acesse o aplicativo em: [https://ambientalsc.github.io/volumosos/](https://ambientalsc.github.io/volumosos/)

## 🚀 Funcionalidades

- 📸 **Captura de fotos** com câmera ou galeria
- 📍 **Geolocalização automática** com endereço simplificado
- 📅 **Registro de data e hora** automático
- 📱 **Interface responsiva** para desktop e mobile
- 📊 **Geração de relatórios** em CSV
- 🗑️ **Exclusão de registros** com long press
- 🔥 **Backend Firebase** para armazenamento

## 🛠️ Tecnologias

- **React 19** - Interface do usuário
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **Firebase** - Backend (Firestore + Storage)
- **Vite** - Build tool

## 📱 Como Usar

### Desktop
1. **Clique** em "Adicionar Foto"
2. **Escolha** entre câmera ou galeria
3. **Permita** acesso à localização
4. **Visualize** os registros na lista
5. **Gere relatórios** com filtros de data

### Mobile
1. **Toque** em "Adicionar Foto"
2. **Pressione e segure** qualquer registro para excluir
3. **Toque** para visualizar imagem ampliada

## 🔧 Instalação Local

```bash
# Clone o repositório
git clone https://github.com/ambientalsc/volumosos.git
cd volumosos

# Instale as dependências
npm install

# Execute em desenvolvimento
npm run dev

# Build para produção
npm run build
```

## 🌐 Deploy

O aplicativo está configurado para GitHub Pages com CI/CD automático:

### GitHub Pages (Recomendado)
1. **Push para main**: O deploy é automático via GitHub Actions
2. **URL**: https://ambientalsc.github.io/volumosos/
3. **Configuração**: Já configurado no workflow `.github/workflows/deploy.yml`

### Deploy Manual
```bash
# Build do projeto
npm run build

# Deploy manual (se necessário)
npm run deploy
```

### Vercel (Alternativa)
1. Conecte o repositório ao Vercel
2. Deploy automático a cada push
3. URL personalizada disponível

## 📱 APK (Android)

Para gerar um APK:

```bash
# Instalar Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# Inicializar Capacitor
npx cap init

# Adicionar plataforma Android
npx cap add android

# Build e sincronizar
npm run build
npx cap sync

# Abrir no Android Studio
npx cap open android
```

## 🔒 Configuração Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com)
2. Configure Firestore e Storage
3. Ative autenticação anônima
4. Configure as regras de segurança
5. Atualize as configurações em `firebase.ts`

## 🔧 Troubleshooting

### Problemas Comuns

1. **Erro de build no GitHub Actions**
   - Verifique se todas as dependências estão no `package.json`
   - Confirme se o Node.js 20 está sendo usado

2. **Página não carrega no GitHub Pages**
   - Verifique se o `base: '/volumosos/'` está configurado no `vite.config.ts`
   - Confirme se o workflow está ativo nas Actions

3. **Firebase não conecta**
   - Verifique as configurações do Firebase em `firebase.ts`
   - Confirme se as regras de segurança estão corretas

4. **Imagens não carregam**
   - Verifique se o Storage do Firebase está configurado
   - Confirme as regras de segurança do Storage

### Logs de Debug
```bash
# Ver logs do build
npm run build

# Ver logs do desenvolvimento
npm run dev
```

## 📄 Licença

Este projeto está sob a licença MIT.
