#!/bin/bash

GENERATED_DIR="generated"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # Sem Cor

function validate_file() {
  local file="$1"

  # Extrai os valores das linhas de detalhe (iniciadas com '2') usando 'cut'
  # A opção -a no grep força o tratamento como texto, evitando o erro de "arquivo binário"
  local values
  values=$(grep -a '^2' "$file" | cut -c 464-478)

  # Imprime os valores para depuração
  # echo "--- Validando arquivo: $file ---"
  # echo "$values" | awk '{print "Linha: " NR ", Valor: " $1}'

  # Calcula a soma
  local calculated_sum
  calculated_sum=$(echo "$values" | awk '{s+=$1} END {print s}' || echo 0)
  
  local footer_line
  footer_line=$(tail -n 1 "$file")

  if [[ ! "$footer_line" == 9* ]]; then
    echo -e "Arquivo: ${file} - ${RED}ERRO: Rodapé inválido ou ausente.${NC}"
    return
  fi

  local footer_total
  footer_total=$((10#$(echo "$footer_line" | cut -c 9-23)))

  if [ "$calculated_sum" -eq "$footer_total" ]; then
    echo -e "Arquivo: ${file} - ${GREEN}OK${NC} (Soma: ${calculated_sum})"
  else
    local difference=$((footer_total - calculated_sum))
    echo -e "Arquivo: ${file} - ${RED}ERRO!${NC} (Soma calculada: ${calculated_sum}, Valor no rodapé: ${footer_total}, Diferença: ${difference})"
  fi
  echo "------------------------------------"
}

function main() {
  if [ ! -d "$GENERATED_DIR" ]; then
    echo -e "${RED}Erro: Diretório '$GENERATED_DIR' não encontrado.${NC}"
    exit 1
  fi

  # Valida todos os arquivos .txt no diretório
  for file in "$GENERATED_DIR"/*.txt; do
    [ -e "$file" ] || continue
    validate_file "$file"
  done

  echo -e "\nValidação concluída."
}

main