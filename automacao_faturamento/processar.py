import os
import csv
import re
import time

# --- 1. DEFINIÇÕES: Pastas e Layouts ---

# Crie estas pastas no mesmo local onde salvar o script
PASTA_ENVIADOS = 'lotes_enviados'
PASTA_RETORNO_ERRO = 'retornos_erro'
PASTA_RETORNO_SUCESSO = 'retornos_sucesso'
ARQUIVO_FINAL_CSV = 'conferencia_final.csv'

# Mapeamento de Posições (início, fim) - Baseado no seu layout
# Contagem começa em 0 (ex: Posição 1-10 é [0:10])
LAYOUT_ENVIADO = {
    'rps_enviado': (15, 25),
    'data_enviada': (25, 33),
    'valor': (463, 478),
    'cpf_cnpj': (504, 518),
    'nome_cliente': (518, 578),
    'discriminacao': (970, 1970)
}

LAYOUT_RETORNO_SUCESSO = {
    'nfse_gerada': (6, 12),
    'codigo_verif': (26, 50),
    'rps_enviado': (54, 64)
}

# Padrão para extrair o RPS Original (Pedido) da descrição
REGEX_PEDIDO = re.compile(r'Pedido (\d+)')

def formatar_valor(valor_str):
    """Converte '000000000019300' para '193.00'"""
    try:
        return f"{int(valor_str[:-2])}.{valor_str[-2:]}"
    except ValueError:
        return "0.00"

def safe_strip(texto):
    """Remove espaços em branco de forma segura"""
    return texto.strip() if texto else ""

def processar_arquivos():
    print("Iniciando processamento...")
    dados_finais = {} # Nosso banco de dados principal (Key = rps_enviado)
    start_time = time.time()

    # --- FASE 1: Ler todos os Lotes ENVIADOS ---
    # Aqui construímos nosso "mapa" principal de-para
    print(f"Fase 1: Lendo arquivos de '{PASTA_ENVIADOS}'...")
    for nome_arquivo in os.listdir(PASTA_ENVIADOS):
        caminho = os.path.join(PASTA_ENVIADOS, nome_arquivo)
        if not os.path.isfile(caminho):
            continue
            
        with open(caminho, 'r', encoding='latin-1') as f:
            for linha in f:
                if linha.startswith('2RPS'):
                    layout = LAYOUT_ENVIADO
                    rps_enviado = safe_strip(linha[layout['rps_enviado'][0]:layout['rps_enviado'][1]])
                    discriminacao = linha[layout['discriminacao'][0]:layout['discriminacao'][1]]
                    
                    # Acha o Pedido (RPS Original) na descrição
                    match = REGEX_PEDIDO.search(discriminacao)
                    rps_original = f"PEDIDO_{match.group(1)}" if match else "NAO_ENCONTRADO"
                    
                    dados_finais[rps_enviado] = {
                        'rps_original': rps_original,
                        'rps_enviado': rps_enviado,
                        'data_enviada': safe_strip(linha[layout['data_enviada'][0]:layout['data_enviada'][1]]),
                        'cliente': safe_strip(linha[layout['nome_cliente'][0]:layout['nome_cliente'][1]]),
                        'cpf_cnpj': safe_strip(linha[layout['cpf_cnpj'][0]:layout['cpf_cnpj'][1]]),
                        'valor': formatar_valor(linha[layout['valor'][0]:layout['valor'][1]]),
                        'status': 'Pendente',
                        'reenvio': 'Não',
                        'nfse_gerada': '',
                        'codigo_verif': '',
                        'erro_inicial': ''
                    }

    print(f"Fase 1 concluída. {len(dados_finais)} RPS de envio encontrados.")

    # --- FASE 2: Ler os Retornos de ERRO ---
    # Marcamos quem falhou na primeira vez
    print(f"Fase 2: Lendo arquivos de '{PASTA_RETORNO_ERRO}'...")
    for nome_arquivo in os.listdir(PASTA_RETORNO_ERRO):
        caminho = os.path.join(PASTA_RETORNO_ERRO, nome_arquivo)
        if not os.path.isfile(caminho):
            continue
            
        with open(caminho, 'r', encoding='latin-1') as f:
            for linha in f:
                if linha.startswith('2RPS'): # O retorno de erro tem o layout do envio
                    rps_enviado = safe_strip(linha[LAYOUT_ENVIADO['rps_enviado'][0]:LAYOUT_ENVIADO['rps_enviado'][1]])
                    
                    # Pega o código de erro no final (ex: "240;")
                    erro_match = re.search(r'(\d+);?$', linha.strip())
                    erro_cod = erro_match.group(1) if erro_match else "ERRO_DESCONHECIDO"

                    if rps_enviado in dados_finais:
                        dados_finais[rps_enviado]['reenvio'] = 'Sim'
                        dados_finais[rps_enviado]['erro_inicial'] = erro_cod
                        dados_finais[rps_enviado]['status'] = f'Erro {erro_cod}'

    print("Fase 2 concluída. RPS com erros iniciais foram marcados.")

    # --- FASE 3: Ler os Retornos de SUCESSO ---
    # Buscamos os dados finais da NFSe (sobrescreve o status de erro)
    print(f"Fase 3: Lendo arquivos de '{PASTA_RETORNO_SUCESSO}'...")
    for nome_arquivo in os.listdir(PASTA_RETORNO_SUCESSO):
        caminho = os.path.join(PASTA_RETORNO_SUCESSO, nome_arquivo)
        if not os.path.isfile(caminho):
            continue

        with open(caminho, 'r', encoding='latin-1') as f:
            for linha in f:
                if linha.startswith('2'): # Layout de Retorno Sucesso
                    layout = LAYOUT_RETORNO_SUCESSO
                    rps_enviado = safe_strip(linha[layout['rps_enviado'][0]:layout['rps_enviado'][1]])

                    if rps_enviado in dados_finais:
                        dados_finais[rps_enviado]['status'] = 'Sucesso'
                        dados_finais[rps_enviado]['nfse_gerada'] = safe_strip(linha[layout['nfse_gerada'][0]:layout['nfse_gerada'][1]])
                        dados_finais[rps_enviado]['codigo_verif'] = safe_strip(linha[layout['codigo_verif'][0]:layout['codigo_verif'][1]])

    print("Fase 3 concluída. Dados de NFSe geradas foram vinculados.")

    # --- FASE 4: Escrever o CSV Final ---
    print(f"Fase 4: Gerando o arquivo final '{ARQUIVO_FINAL_CSV}'...")
    if not dados_finais:
        print("Nenhum dado encontrado. Verifique se os arquivos estão nas pastas corretas.")
        return

    # Pega as colunas do primeiro item para criar o cabeçalho
    colunas = list(dados_finais.values())[0].keys()

    with open(ARQUIVO_FINAL_CSV, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=colunas, delimiter=';') # Use ';' para Excel BR
        writer.writeheader()
        
        count = 0
        for dados_rps in dados_finais.values():
            writer.writerow(dados_rps)
            count += 1
            
    end_time = time.time()
    print("\n--- SUCESSO! ---")
    print(f"Arquivo '{ARQUIVO_FINAL_CSV}' foi gerado com {count} linhas.")
    print(f"Tempo total: {end_time - start_time:.2f} segundos.")

# --- Executa o script ---
if __name__ == "__main__":
    processar_arquivos()