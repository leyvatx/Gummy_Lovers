# Despliegue en Oracle Cloud Always Free

Esta es la mejor opción sin pagar nada para `Gummy Lover's` si no quieres depender de tu PC.

## Qué monta

- `app`: Django + DRF + frontend React compilado
- `db`: PostgreSQL persistente en volumen Docker
- `caddy`: HTTPS automático con `sslip.io`

## Requisitos

1. Una cuenta de Oracle Cloud con recursos `Always Free`
2. Una VM Ubuntu pública
3. Puertos abiertos en el Security List o NSG:
   - `80/tcp`
   - `443/tcp`
   - `22/tcp`

## 1. Crear la VM

Usa una instancia `Always Free` con Ubuntu.

Es mejor reservar una IP pública estática para que no cambie el dominio `sslip.io`.

## 2. Instalar Docker

Conéctate por SSH y ejecuta:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
sudo usermod -aG docker $USER
newgrp docker
```

## 3. Clonar el proyecto

```bash
git clone https://github.com/leyvatx/Gummy_Lovers.git
cd Gummy_Lovers
```

## 4. Crear variables de producción

```bash
cp .env.oracle.example .env.oracle
```

Edita `.env.oracle`:

- `APP_DOMAIN`: usa tu IP pública con `sslip.io`
  - ejemplo: `168.138.10.25.sslip.io`
- `DJANGO_SECRET_KEY`: una clave larga y aleatoria
- `POSTGRES_PASSWORD`: una password fuerte
- `GUMMY_EFRAIN_PASSWORD`: password real
- `GUMMY_ERIKA_PASSWORD`: password real
- `LETSENCRYPT_EMAIL`: tu correo

## 5. Levantar producción

```bash
docker compose --env-file .env.oracle -f docker-compose.oracle.yml up -d --build
```

## 6. Entrar al sistema

Abre:

```text
https://TU_IP.sslip.io
```

## Comandos útiles

Ver logs:

```bash
docker compose --env-file .env.oracle -f docker-compose.oracle.yml logs -f
```

Reiniciar:

```bash
docker compose --env-file .env.oracle -f docker-compose.oracle.yml restart
```

Actualizar después de cambios:

```bash
git pull
docker compose --env-file .env.oracle -f docker-compose.oracle.yml up -d --build
```

## Notas importantes

- Oracle `Always Free` no es trial, pero Oracle puede recuperar recursos muy ociosos.
- Para minimizar ese riesgo, conviene usar la instancia de forma continua.
- Si no quieres depender de `sslip.io`, después puedes cambiar `APP_DOMAIN` a un dominio propio.
