# Mestre Weber – Golaarion

Conjunto de ajustes para o sistema **Pathfinder 2e (pf2e)** no Foundry VTT.

## Requisitos

- Foundry VTT versão 13 ou superior (verificado até a 14)
- Sistema **pf2e** versão 7 ou superior
- Módulo **socketlib** (obrigatório)
- Módulo **PF2e Skill Actions** (opcional, recomendado — veja a função 1 abaixo)

## Funções

### 1. Subcategorias por perícia no PF2e Skill Actions

Se o módulo **PF2e Skill Actions** estiver ativo, a lista "Skill Actions" que ele
adiciona à aba Ações da ficha do personagem é automaticamente reorganizada em
subgrupos por perícia (Acrobacia, Atletismo, Furtividade, etc.), em vez de uma
lista única. Ações sem perícia definida (como Descansar a Noite ou Recall
Knowledge) caem em um grupo "Geral".

### 2. Destaque de pré-requisitos não cumpridos

Ao pesquisar talentos na aba Talentos do Buscador de Compêndio, aberto a partir
da própria ficha de um personagem, os talentos que esse personagem **não**
cumpre os pré-requisitos para pegar (nível insuficiente, treino mínimo de
perícia não atingido, ou falta de um talento/característica/ancestralidade
exigido) aparecem destacados em vermelho na lista de resultados.

### 3. Aviso ao Mestre sobre mudanças na ficha do jogador

Sempre que um jogador altera a própria ficha ou token, o Mestre recebe um
sussurro automático no chat com o resumo da mudança:

- Vida recuperada ou perdida
- Pontos de Heroísmo ganhos ou gastos
- Pontos de Foco ganhos ou gastos
- Slots de magia recuperados ou gastos
- Talentos ganhos ou perdidos (inclusive troca de talento)
- Condições ganhas, perdidas ou com valor alterado (ex.: Enfraquecido 2)

O sussurro é enviado só para o Mestre; o jogador que fez a mudança não o vê.

### 4. Notificação de turno

Em combates com **mais de 2 participantes**, assim que o turno de um
combatente começa, o módulo avisa com antecedência o jogador dono do **próximo**
combatente da ordem de iniciativa — uma notificação na tela mais um sonzinho
discreto — para que ele já comece a se preparar.

Configurável em Configurações do Mundo:

- **Notificação de turno** — ativa ou desativa o aviso
- **Volume da notificação de turno** — volume do som tocado

### 5. Escolha dos livros permitidos na mesa

O Mestre pode restringir, para os jogadores, quais livros/fontes aparecem na
criação de personagem e nas buscas de itens, talentos, magias etc. — tanto no
Buscador de Compêndio do sistema quanto ao abrir os compêndios diretamente pela
aba Compêndios. O Mestre continua vendo tudo normalmente, e nada é apagado:
basta desmarcar ou desativar o filtro a qualquer momento para restaurar o
acesso completo.

Acesso: aba Compêndios → botão **Livros**, ao lado de "Criar Compêndio"
(visível só para o Mestre).

### 6. Anúncio dramático em tela cheia

Um aviso de tela cheia com partículas em espiral, texto animado e som, pensado
para momentos marcantes: o grupo chega a um novo local, avança um marco da
campanha, conclui um objetivo principal, etc. Enquanto dura, toda a UI do
Foundry some — barra de cenas, hotbar, sidebar, lista de jogadores, controles
de cena e qualquer janela aberta (inclusive fichas de personagem) — em cada
cliente conectado, pra imersão total; tudo volta com fade-in assim que o
anúncio termina. No lugar da hotbar (que fica escondida), aparece a
assinatura "Mestre Weber – Golaarion", que some com o mesmo fade quando a UI
volta.

Cores (texto, brilho, lampejo, subtítulo, partículas), intensidade do
escurecimento de fundo, animação padrão e **som** (um único arquivo de áudio,
escolhido pelo seletor de arquivos, tocado em todo anúncio — não dá pra
escolher um som diferente por chamada) são configuráveis em Configurações do
Mundo.

Para o caso mais comum — revelar um novo local — não precisa de macro: um
botão (ícone de mapa) aparece na barra de navegação de cenas, ao lado da lista
de cenas, visível só para o Mestre. Ao clicar, um formulário pergunta o nome
do local (a primeira letra de cada palavra é maiúscula automaticamente, não
importa como foi digitado) e dispara o anúncio na hora, com o som configurado
(se houver).

Junto com as partículas em espiral, os tokens dos personagens da Party
marcada como principal (`game.actors.party`) também caem em espiral rumo ao
centro da tela, meio transparentes até sumir de vez perto do fim do caminho —
usa o token deles na cena atual, ou o retrato padrão se não tiverem token na
cena.

Para outros momentos (marco, objetivo, etc.) ou para customizar
subtítulo/animação, dispare o aviso via API, direto de um macro ou script (o
som não entra aqui — é sempre o único configurado em Configurações do Mundo):

```js
game.modules.get("mestre-weber-golaarion").api.showAnnouncement(
  title,       // texto principal (obrigatório)
  subtitle,    // subtítulo opcional, ou "" / null
  animation,   // "reveal" (fade suave) ou "fall" (queda do alto); opcional, usa o padrão configurado
  duration,    // duração total em ms; opcional
  soundDelay,  // atraso antes de tocar o som, em ms; opcional
  textDelay    // atraso antes do texto começar a aparecer, em ms; opcional
);
```

O aviso é exibido para **todos os jogadores conectados** (via socket do
Foundry), não só para quem chamou a API.

### 7. Resumo ao iniciar o mundo

Assim que o mundo termina de carregar, o Mestre recebe um sussurro no chat
listando o estado de cada função acima nessa sessão: se as Subcategorias por
perícia estão ativas (depende do PF2e Skill Actions estar ativo), se a
Notificação de turno está ligada e com qual volume, se há restrição de Livros
permitidos, e qual a animação padrão do Anúncio de tela. Só o Mestre vê essa
mensagem.

## Origem

Este módulo reúne, em um pacote único e distribuível, funcionalidades
originalmente desenvolvidas nos módulos pessoais **Mestre Weber**,
**Mestre Weber – PF2e** e **Mestre Weber – Fora do Abismo**. O aviso em tela
(função 6) foi generalizado a partir do recurso "Dádiva" daquela campanha
específica, para uso em qualquer mesa.
