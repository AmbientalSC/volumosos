# Guia de Contribuição

Obrigado por considerar contribuir para o projeto Registro Fotográfico Geo! 

## Como Contribuir

### 1. Fork e Clone

1. Faça um fork do repositório
2. Clone seu fork localmente:
   ```bash
   git clone https://github.com/seu-usuario/volumosos.git
   cd volumosos
   ```

### 2. Configurar o Ambiente

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure o Firebase (se necessário):
   - Crie um projeto no Firebase Console
   - Configure Firestore e Storage
   - Atualize as configurações em `firebase.ts`

3. Execute em desenvolvimento:
   ```bash
   npm run dev
   ```

### 3. Desenvolvimento

1. Crie uma branch para sua feature:
   ```bash
   git checkout -b feature/nova-funcionalidade
   ```

2. Faça suas alterações seguindo os padrões:
   - Use TypeScript
   - Siga o estilo de código existente
   - Adicione comentários quando necessário
   - Teste suas mudanças

3. Commit suas mudanças:
   ```bash
   git add .
   git commit -m "feat: adiciona nova funcionalidade"
   ```

### 4. Testes

1. Execute os testes (se houver):
   ```bash
   npm test
   ```

2. Teste o build:
   ```bash
   npm run build
   ```

3. Teste localmente:
   ```bash
   npm run preview
   ```

### 5. Pull Request

1. Push para sua branch:
   ```bash
   git push origin feature/nova-funcionalidade
   ```

2. Crie um Pull Request no GitHub
3. Use o template de PR fornecido
4. Aguarde a revisão

## Padrões de Código

### TypeScript
- Use tipagem forte
- Evite `any` quando possível
- Use interfaces para estruturas de dados

### React
- Use hooks funcionais
- Mantenha componentes pequenos e focados
- Use props tipadas

### Estilo
- Use Tailwind CSS para estilização
- Mantenha consistência com o design existente
- Teste em diferentes tamanhos de tela

## Estrutura do Projeto

```
volumosos/
├── components/          # Componentes React
├── public/             # Arquivos estáticos
├── .github/            # Configurações do GitHub
├── App.tsx            # Componente principal
├── firebase.ts         # Configuração do Firebase
├── types.ts           # Tipos TypeScript
└── vite.config.ts     # Configuração do Vite
```

## Commit Messages

Use o padrão Conventional Commits:

- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Documentação
- `style:` Formatação
- `refactor:` Refatoração
- `test:` Testes
- `chore:` Manutenção

## Issues

Antes de criar uma issue:

1. Verifique se já existe uma issue similar
2. Use o template fornecido
3. Forneça informações detalhadas
4. Inclua screenshots se aplicável

## Deploy

O deploy é automático via GitHub Actions:

1. Push para `main` dispara o deploy
2. O build é feito automaticamente
3. O site é publicado em https://ambientalsc.github.io/volumosos/

## Suporte

Se você tiver dúvidas:

1. Verifique a documentação
2. Procure por issues similares
3. Crie uma issue se necessário

Obrigado por contribuir! 🚀 