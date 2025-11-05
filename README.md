# Gerador de Arquivo de Remessa RPS - Barueri

Este projeto consiste em um script Node.js para a geração de arquivos de remessa no formato RPS (Recibo Provisório de Serviços), seguindo o layout exigido pela prefeitura de Barueri/SP.

O script é capaz de processar dados de múltiplas fontes para diferentes empresas e gerar os arquivos de texto no formato correto para envio.

## Funcionalidades

-   **Geração de Arquivos RPS**: Cria arquivos de texto no layout `PMB002` da prefeitura de Barueri.
-   **Suporte a Múltiplas Empresas**: Processa dados de forma distinta para as empresas `iguanafix` e `triider`.
-   **Fontes de Dados Flexíveis**:
    -   **Iguanafix**: Busca os dados de um banco de dados (configurado via variáveis de ambiente).
    -   **Triider**: Processa os dados a partir de um arquivo CSV local.(já implementado e aguardando acesso ao banco de dados real)
-   **Divisão Automática**: Os arquivos de remessa são automaticamente divididos em lotes (chunks) de 1000 RPS, conforme exigido.
-   **Scripts Auxiliares**: Inclui scripts de shell para validação e diagnóstico dos arquivos gerados.

## Pré-requisitos

-   [Node.js](https://nodejs.org/) (versão 16 ou superior)
-   [NPM](https://www.npmjs.com/) (geralmente instalado com o Node.js)

## Instalação

1.  Clone este repositório para a sua máquina local.

2.  Instale as dependências do projeto:
    ```bash
    npm install
    ```

3.  Crie um arquivo de configuração de ambiente chamado `.env` na raiz do projeto. Este arquivo é necessário para a conexão com o banco de dados (usado pela empresa Iguanafix). Você pode usar o arquivo `database.js` como referência para saber quais variáveis são necessárias.
O formato utilizado é com prefixo no formato ${db}_:

    **Exemplo de arquivo `.env` para db = xpto:**
    ```
    $xpto_DB_HOST=seu_host
    $xpto_DB_USER=seu_usuario
    $xpto_DB_PASS=sua_senha
    $xpto_DB_NAME=seu_banco_de_dados
    ```

## Como Usar

### Geração dos Arquivos de Remessa

O script principal é executado através do NPM, passando os parâmetros de ano, mês e empresa.

**Comando base:**
```bash
npm run start -- --year=<ANO> --month=<MÊS> --company=<EMPRESA>
```

**Argumentos:**
-   `--year`: (Obrigatório) O ano de competência dos serviços (ex: `2025`).
-   `--month`: (Obrigatório) O mês de competência dos serviços (ex: `9` para Setembro).
-   `--company`: (Opcional) A empresa para a qual gerar os arquivos.
    -   Valores possíveis: `iguanafix` ou `triider`.
    -   Se omitido, o valor padrão será `iguanafix`.

---

#### **Exemplo para Iguanafix:**

Para gerar os arquivos da Iguanafix para o mês de setembro de 2025:
```bash
npm run start -- --year=2025 --month=9 --company=iguanafix
```
*(ou simplesmente `npm run start -- --year=2025 --month=9`, pois `iguanafix` é o padrão)*

---

#### **Exemplo para Triider:**

Para gerar os arquivos da Triider, é necessário que um arquivo CSV com os dados esteja presente na pasta `data/` do projeto. O nome do arquivo deve seguir o formato `triider-MM-YYYY.csv`.

1.  **Nome do arquivo:** `triider-09-2025.csv`
2.  **Comando para execução:**
    ```bash
    npm run start -- --year=2025 --month=9 --company=triider
    ```

Os arquivos de remessa gerados serão salvos no diretório `generated/`.

### Scripts Auxiliares

O projeto conta com scripts de shell para facilitar a validação e análise dos arquivos.

#### Validar Soma dos Arquivos

O script `validate_remessas.sh` verifica se a soma dos valores de serviço em cada arquivo corresponde ao total declarado no rodapé.

**Como usar:**
```bash
./validate_remessas.sh
```
O script analisará todos os arquivos `.txt` dentro da pasta `generated/` e informará se a soma está `OK` ou se há `ERRO`.

### Conciliação de Envios e Retornos (`processar.py`)

Dentro da pasta `automacao_faturamento/`, existe um script Python (`processar.py`) projetado para automatizar a conciliação entre os lotes de RPS enviados e os arquivos de retorno (sucesso e erro) da prefeitura.

O objetivo é gerar um único arquivo CSV (`conferencia_final.csv`) que centraliza o status de cada RPS enviado.

#### Pré-requisitos

-   Python 3.x instalado.

#### Estrutura de Pastas

Para que o script funcione, você deve criar a seguinte estrutura de pastas dentro de `automacao_faturamento/`:

-   `lotes_enviados/`: Coloque aqui todos os arquivos de remessa `.txt` que foram enviados à prefeitura.
-   `retornos_erro/`: Coloque aqui os arquivos `.ERR` retornados pela prefeitura.
-   `retornos_sucesso/`: Coloque aqui os arquivos de retorno com as NFSe geradas com sucesso.

#### Como Usar

1.  Navegue até a pasta da automação:
    ```bash
    cd automacao_faturamento
    ```

2.  Execute o script Python:
    ```bash
    python3 processar.py
    ```

#### Resultado

O script irá processar todos os arquivos nas três pastas e gerar um arquivo chamado `conferencia_final.csv` na pasta `automacao_faturamento/`. Este arquivo conterá uma linha para cada RPS enviado, com as seguintes colunas:

-   `rps_original`: O número do pedido original.
-   `rps_enviado`: O número do RPS sequencial gerado no lote.
-   `data_enviada`: Data de competência.
-   `cliente`: Nome do tomador do serviço.
-   `cpf_cnpj`: Documento do tomador.
-   `valor`: Valor do serviço.
-   `status`: O status final (`Sucesso`, `Erro <código>`, ou `Pendente`).
-   `reenvio`: `Sim` se o RPS foi encontrado em um lote de erro.
-   `nfse_gerada`: O número da Nota Fiscal de Serviço Eletrônica gerada.
-   `codigo_verif`: O código de verificação da NFSe.
-   `erro_inicial`: O código do erro, caso tenha ocorrido.

Este arquivo é ideal para conferência e análise.

### Debug no VS Code

O projeto já vem com uma configuração de debug para o VS Code no arquivo `.vscode/launch.json`.

1.  Abra o arquivo `main.js` ou qualquer outro que deseje depurar.
2.  Adicione *breakpoints* clicando na margem à esquerda do número da linha.
3.  Vá para a aba "Executar e Depurar" (`Ctrl+Shift+D`).
4.  No menu suspenso, selecione **"Debug main.js"**.

O script será executado e pausará nos breakpoints definidos, permitindo a inspeção de variáveis e o controle do fluxo de execução. Você pode alterar os argumentos (`year`, `month`, `company`) diretamente no arquivo `launch.json` para testar diferentes cenários.
