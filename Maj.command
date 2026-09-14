#!/bin/bash
# ============================================================
#  METTRE LE SITE A JOUR — double-cliquer ce fichier.
#  Rien a taper. Il reprend tout ce qui a ete depose :
#    - polices        assets/fonts/
#    - vignettes des auteurs  assets/authorfaces/
#    - medias des fontes      fonts/<slug>/media/
#  et cree les pages manquantes.
# ============================================================

cd "$(dirname "$0")" || exit 1

# Retrouver node meme si le PATH du Finder est incomplet
NODE=""
for candidate in "$(command -v node)" /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
  if [ -x "$candidate" ]; then NODE="$candidate"; break; fi
done

if [ -z "$NODE" ]; then
  echo "Node.js est introuvable sur cet ordinateur."
  echo "Installe-le depuis https://nodejs.org (version LTS), puis relance ce fichier."
  echo
  read -r -p "Appuie sur Entree pour fermer."
  exit 1
fi

echo "============================================"
echo " BS.type — mise a jour du site"
echo "============================================"
echo
"$NODE" scripts/sync-fonts.js
echo
echo "Termine."
echo "Dans le navigateur, recharge la page en forcant le cache :"
echo "  Cmd + Maj + R"
echo
read -r -p "Appuie sur Entree pour fermer."
