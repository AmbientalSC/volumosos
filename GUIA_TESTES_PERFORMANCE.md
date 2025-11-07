# 🧪 Guia de Teste - Otimizações de Performance

## Checklist de Testes

### ✅ 1. Teste de Compressão Visual

**Objetivo:** Verificar que imagens são comprimidas sem perda perceptível de qualidade

**Passos:**
1. Abra o app no navegador: `npm run dev`
2. Abra DevTools (F12) → Console
3. Clique em "Adicionar Foto" → "Tirar Foto com a Câmera"
4. Tire uma foto de teste
5. **Verifique no console:**
   ```
   Comprimindo imagem...
   Imagem comprimida: 5234.2KB → 387.5KB (93% menor)
   ```
6. **Verifique na UI:**
   - Mensagem verde aparece: "✅ Imagem otimizada: XXX KB → YYY KB (Z% menor)"
   - Foto exibida mantém boa qualidade visual

**Critério de Sucesso:**
- ✅ Redução de tamanho > 70%
- ✅ Qualidade visual boa (sem pixelização excessiva)
- ✅ Mensagem de confirmação aparece

---

### ✅ 2. Teste de Barra de Progresso

**Objetivo:** Verificar feedback visual durante upload

**Passos:**
1. Abra o app
2. Tire uma foto
3. **Observe durante o processo:**
   - Spinner aparece
   - Mensagem muda em sequência:
     - "Processando imagem..."
     - "Comprimindo..."
     - "Enviando..."
     - "Finalizando..."
     - "Concluído!"
   - Barra azul avança gradualmente
   - Percentual aumenta: 0% → 100%

**Critério de Sucesso:**
- ✅ Todas as 5 etapas aparecem
- ✅ Barra de progresso animada
- ✅ Percentual exibido e preciso

---

### ✅ 3. Teste de Upload Rápido

**Objetivo:** Comparar velocidade antes x depois

**Método 1: Cronômetro Manual**
1. Prepare um cronômetro
2. Clique "Adicionar Foto"
3. **INICIE** cronômetro ao escolher foto
4. **PARE** quando aparecer "✅ Imagem otimizada"
5. Anote o tempo

**Resultado Esperado (com 4G):**
- Antes: ~15-20s
- Depois: **~2-5s** ⚡

**Método 2: DevTools Performance**
1. F12 → Performance tab
2. Click "Record"
3. Tire foto
4. Pare gravação quando upload terminar
5. Veja timeline

---

### ✅ 4. Teste de Sincronização Paralela

**Objetivo:** Verificar que registros pendentes sincronizam 2 por vez

**Passos:**
1. **Simular offline:**
   - Ative modo avião OU
   - DevTools → Network tab → Throttling → Offline
2. Tire **4 fotos** (serão armazenadas localmente)
3. Veja mensagem: "4 registro(s) aguardando sincronização"
4. **Voltar online:**
   - Desative modo avião OU
   - DevTools → Network → No throttling
5. **Observe no Console:**
   ```
   Tentando sincronizar 4 registros pendentes...
   Comprimindo imagem... (foto 1)
   Comprimindo imagem... (foto 2) ← PARALELO! 
   Imagem enviada com sucesso (foto 1)
   Imagem enviada com sucesso (foto 2)
   Comprimindo imagem... (foto 3)
   Comprimindo imagem... (foto 4) ← PARALELO!
   ...
   ```

**Critério de Sucesso:**
- ✅ Processa 2 uploads simultaneamente
- ✅ Mais rápido que processar 1 por vez
- ✅ Todos os 4 registros sincronizam sem erros

---

### ✅ 5. Teste de Comparação de Tamanho (Firebase)

**Objetivo:** Confirmar economia de storage

**Passos:**
1. Acesse Firebase Console: https://console.firebase.google.com
2. Vá em **Storage** → `volumosos-d6369.firebasestorage.app`
3. Navegue até pasta `images/`
4. **Compare tamanhos:**
   - Arquivos antigos (se houver): ~5-8 MB
   - Arquivos novos (após otimização): ~300-500 KB

**Critério de Sucesso:**
- ✅ Novos uploads **10-20x menores**
- ✅ Qualidade visual similar ao visualizar

---

### ✅ 6. Teste de Conexão Lenta (3G)

**Objetivo:** Verificar que funciona bem em rede lenta

**Passos:**
1. DevTools (F12) → Network tab
2. Throttling: **Slow 3G**
3. Tire uma foto
4. **Observe:**
   - Compressão acontece rápido (local)
   - Upload demora ~5-10s (esperado em 3G)
   - Barra de progresso reflete corretamente
   - **NÃO dá timeout** (limite é 30s)

**Critério de Sucesso:**
- ✅ Upload completa com sucesso em 3G
- ✅ Tempo < 15s para foto comprimida
- ✅ Sem erros de timeout

---

### ✅ 7. Teste de Qualidade de Imagem

**Objetivo:** Garantir que compressão não degrada muito

**Passos:**
1. Tire foto de objeto com texto (ex: placa, documento)
2. Após upload, clique na imagem para ampliar
3. Verifique:
   - Texto ainda legível?
   - Cores fiéis ao original?
   - Bordas sem artefatos excessivos?

**Critério de Sucesso:**
- ✅ Texto legível (se estava legível no original)
- ✅ Cores naturais
- ✅ Sem blur excessivo

---

### ✅ 8. Teste de Estatísticas de Compressão

**Objetivo:** Confirmar que usuário vê economia

**Passos:**
1. Tire uma foto grande (use câmera traseira em alta qualidade)
2. **Observe após upload:**
   - Caixa verde aparece por ~3 segundos
   - Mostra: "✅ Imagem otimizada: X KB → Y KB (Z% menor)"
   - Percentual deve ser > 70%

**Critério de Sucesso:**
- ✅ Mensagem aparece
- ✅ Valores corretos (KB reduzido)
- ✅ Percentual calculado corretamente
- ✅ Desaparece após ~3s

---

## 🐛 Troubleshooting

### Problema: Compressão muito agressiva (imagem pixelada)

**Solução:** Ajustar parâmetros em `App.tsx`:

```typescript
// Linha ~164
const compressedBlob = await compressImage(
  file,
  2560,  // Era 1920 - aumenta resolução
  1440,  // Era 1080 - aumenta resolução
  0.92   // Era 0.85 - menos compressão
);
```

### Problema: Upload ainda lento

**Diagnóstico:**
1. Verifique velocidade real da conexão
2. DevTools → Network → veja tamanho real do upload
3. Firebase Console → Storage → confirme CORS configurado

**Soluções:**
- Se 3G: Normal demorar ~5-10s
- Se WiFi lento: Verificar roteador
- Se Firebase: Confirmar região do bucket próxima

### Problema: Barra de progresso não aparece

**Diagnóstico:**
1. F12 → Console → veja erros
2. Confirme que `uploadProgress` state está atualizando

**Solução:**
- Rebuild: `npm run build:native`
- Limpar cache: Ctrl+Shift+Delete
- Testar em navegador moderno

### Problema: Sincronização não processa 2 em paralelo

**Diagnóstico:**
1. Console: veja logs "Tentando sincronizar..."
2. Confirme que há pelo menos 2 registros pendentes

**Solução:**
- Adicionar mais registros offline (precisa >=2)
- Verificar `PARALLEL_UPLOADS` constante em `syncPendingRecords`

---

## 📊 Métricas Esperadas

### Performance
| Métrica | Antes | Depois | Meta |
|---------|-------|--------|------|
| Tamanho médio | 5 MB | 400 KB | < 500 KB ✅ |
| Tempo upload 4G | 15s | 3s | < 5s ✅ |
| Tempo upload 3G | 60s+ | 8s | < 15s ✅ |
| Timeout rate | ~5% | <1% | 0% ideal |

### Custos (100 uploads/mês)
| Item | Antes | Depois | Economia |
|------|-------|--------|----------|
| Storage usado | 500 MB | 40 MB | **92%** |
| Banda download | 500 MB | 40 MB | **92%** |
| Custo Firebase | ~$0.013 | ~$0.001 | **92%** |

---

## ✅ Checklist Final

Antes de considerar testes concluídos:

- [ ] Compressão funciona (console mostra redução > 70%)
- [ ] Barra de progresso aparece e anima
- [ ] Mensagem de estatísticas exibe corretamente
- [ ] Upload completa em < 5s (4G)
- [ ] Upload completa em < 15s (3G simulado)
- [ ] Sincronização processa 2 uploads em paralelo
- [ ] Qualidade visual permanece boa
- [ ] Firebase Storage mostra arquivos pequenos (~400 KB)
- [ ] Offline-first continua funcionando
- [ ] Sem erros no Console (F12)

---

## 🚀 Deploy para Produção

Após todos os testes passarem:

```bash
# Web (GitHub Pages)
npm run build
git add .
git commit -m "feat: otimizações de performance - compressão de imagens"
git push origin main

# Android
npm run android:sync
# Abrir Android Studio e fazer Run
```

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique `OTIMIZACOES_PERFORMANCE.md` para detalhes técnicos
2. Console (F12) → copie erros completos
3. Firebase Console → Storage Rules → confirme permissões
4. Teste em navegador diferente (Chrome vs Firefox)

**Última atualização:** 7 de novembro de 2025
