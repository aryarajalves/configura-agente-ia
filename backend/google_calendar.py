import os
import datetime
import json
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from sqlalchemy import select
from models import GoogleTokensModel
from database import AsyncSession

# Escopos necessários para gerenciar eventos e calendário
SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly']

class GoogleCalendarService:
    def __init__(self, agent_id: int | None, db: AsyncSession):
        self.agent_id = agent_id
        self.db = db
        self.client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        self.redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    async def get_auth_url(self):
        """Gera a URL de autorização para o usuário clicar."""
        if not self.client_id or not self.client_secret:
            print("[GCAL DEBUG] ✖ Erro: GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados no .env")
            return None

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=SCOPES
        )
        flow.redirect_uri = self.redirect_uri
        auth_url, _ = flow.authorization_url(access_type='offline', prompt='consent', state=str(self.agent_id or 'global'))
        return auth_url

    async def save_tokens(self, code: str):
        """Troca o código pelo token e salva no banco."""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=SCOPES
        )
        flow.redirect_uri = self.redirect_uri
        flow.fetch_token(code=code)
        creds = flow.credentials

        result = await self.db.execute(select(GoogleTokensModel).where(GoogleTokensModel.agent_id == self.agent_id))
        db_token = result.scalars().first()

        if not db_token:
            db_token = GoogleTokensModel(agent_id=self.agent_id)
            self.db.add(db_token)

        db_token.access_token = creds.token
        if creds.refresh_token:
            db_token.refresh_token = creds.refresh_token
        db_token.expiry = creds.expiry
        db_token.scopes = json.dumps(list(creds.scopes) if creds.scopes else SCOPES)
        db_token.client_id = self.client_id
        db_token.client_secret = self.client_secret

        await self.db.commit()
        return True

    async def get_credentials(self):
        """Recupera e renova as credenciais se necessário."""
        print(f"[GCAL DEBUG] get_credentials | agent_id={self.agent_id}")
        print(f"[GCAL DEBUG] env vars | GOOGLE_CLIENT_ID={self.client_id[:20] if self.client_id else None}... | REDIRECT={self.redirect_uri}")
        result = await self.db.execute(select(GoogleTokensModel).where(GoogleTokensModel.agent_id == self.agent_id))
        db_token = result.scalars().first()

        if not db_token and self.agent_id is not None:
            print(f"[GCAL DEBUG] ℹ Nenhum token para agent_id={self.agent_id}, tentando global...")
            result = await self.db.execute(select(GoogleTokensModel).where(GoogleTokensModel.agent_id == None))
            db_token = result.scalars().first()

        if not db_token:
            print(f"[GCAL DEBUG] ✖ Nenhum token encontrado no banco.")
            return None

        print(f"[GCAL DEBUG] token encontrado | access_token_prefix={str(db_token.access_token)[:20] if db_token.access_token else None} | refresh_token={bool(db_token.refresh_token)} | expiry={db_token.expiry}")

        creds = Credentials(
            token=db_token.access_token,
            refresh_token=db_token.refresh_token,
            token_uri=db_token.token_uri,
            client_id=db_token.client_id,
            client_secret=db_token.client_secret,
            scopes=json.loads(db_token.scopes) if db_token.scopes else SCOPES
        )

        print(f"[GCAL DEBUG] creds | expired={creds.expired} | valid={creds.valid} | scopes={creds.scopes}")

        if creds.expired and creds.refresh_token:
            print(f"[GCAL DEBUG] Token expirado, renovando...")
            try:
                creds.refresh(Request())
                db_token.access_token = creds.token
                db_token.expiry = creds.expiry
                await self.db.commit()
                print(f"[GCAL DEBUG] Token renovado com sucesso | novo_expiry={creds.expiry}")
            except Exception as e:
                import traceback
                print(f"[GCAL ERROR] Falha ao renovar token: {e}")
                print(traceback.format_exc())

        return creds

    async def get_service(self):
        """Retorna o objeto 'service' da API do Google Calendar."""
        creds = await self.get_credentials()
        if not creds:
            print("[GCAL DEBUG] get_service: sem credenciais, retornando None")
            return None
        print(f"[GCAL DEBUG] get_service: construindo service com creds válidas={creds.valid}")
        try:
            service = build('calendar', 'v3', credentials=creds)
            print("[GCAL DEBUG] get_service: service construído com sucesso")
            return service
        except Exception as e:
            import traceback
            print(f"[GCAL ERROR] get_service falhou: {e}")
            print(traceback.format_exc())
            return None

    # --- Operações de Calendário ---

    async def list_events(self, max_results=10, time_min=None, time_max=None):
        """
        Lista eventos do calendário num intervalo de datas.
        time_min: ISO 8601 - início do intervalo (padrão: agora, para eventos futuros)
        time_max: ISO 8601 - fim do intervalo (para buscar eventos passados)
        Se time_max for fornecido sem time_min, usa time_max - 30 dias como time_min.
        """
        service = await self.get_service()
        if not service: return []

        now_utc = datetime.datetime.utcnow()

        if time_min is None and time_max is None:
            # Comportamento padrão: próximos eventos
            time_min = now_utc.isoformat() + 'Z'
        elif time_min is None and time_max is not None:
            # Busca passado: time_min = time_max - 60 dias
            try:
                dt_max = datetime.datetime.fromisoformat(time_max.replace('Z', '+00:00')).replace(tzinfo=None)
            except Exception:
                dt_max = now_utc
            time_min = (dt_max - datetime.timedelta(days=60)).isoformat() + 'Z'

        params = {
            'calendarId': 'primary',
            'timeMin': time_min,
            'maxResults': max_results,
            'singleEvents': True,
            'orderBy': 'startTime'
        }
        if time_max:
            params['timeMax'] = time_max

        events_result = service.events().list(**params).execute()
        return events_result.get('items', [])

    # Alias para compatibilidade
    async def list_upcoming_events(self, max_results=10):
        return await self.list_events(max_results=max_results)

    async def create_event(self, summary, start_time, end_time, description=None, location=None,
                           attendees=None, recurrence=None, color=None):
        """
        Cria um novo evento no Google Calendar.
        summary: Título do evento
        start_time: ISO format string (ex: '2024-10-25T09:00:00-03:00')
        end_time: ISO format string
        attendees: lista de e-mails dos convidados (ex: ['joao@email.com', 'maria@email.com'])
        recurrence: string RRULE (ex: 'RRULE:FREQ=WEEKLY;COUNT=10') ou None para evento único
        color: nome da cor (ex: 'vermelho', 'azul', 'verde') ou colorId (1-11)
        """
        print(f"[GCAL DEBUG] create_event | summary={summary} | start={start_time} | end={end_time} | attendees={attendees} | recurrence={recurrence} | color={color}")
        service = await self.get_service()
        if not service:
            print("[GCAL DEBUG] create_event: service é None, abortando")
            return None

        event = {
            'summary': summary,
            'description': description,
            'location': location,
            'start': {'dateTime': start_time, 'timeZone': 'America/Sao_Paulo'},
            'end': {'dateTime': end_time, 'timeZone': 'America/Sao_Paulo'},
        }

        # Cor do evento no Google Calendar
        color_id = resolve_color_id(color)
        if color_id:
            event['colorId'] = color_id

        # Convidados por e-mail
        if attendees:
            emails = [a.strip() for a in attendees] if isinstance(attendees, list) else [a.strip() for a in str(attendees).split(',')]
            event['attendees'] = [{'email': e} for e in emails if e]

        # Recorrência
        if recurrence:
            # Aceita tanto 'RRULE:FREQ=WEEKLY' quanto dict-like
            rule = recurrence if recurrence.startswith('RRULE:') else f'RRULE:{recurrence}'
            event['recurrence'] = [rule]

        print(f"[GCAL DEBUG] create_event payload: {event}")

        try:
            created = service.events().insert(
                calendarId='primary', body=event,
                sendUpdates='all'  # Notifica os convidados por e-mail
            ).execute()
            print(f"[GCAL DEBUG] create_event: evento criado! id={created.get('id')} | link={created.get('htmlLink')}")
            return created
        except Exception as e:
            import traceback
            print(f"[GCAL ERROR] create_event falhou: {type(e).__name__}: {e}")
            print(traceback.format_exc())
            raise

    async def update_event(self, event_id, summary=None, start_time=None, end_time=None,
                           description=None, location=None, attendees=None, recurrence=None, color=None):
        """
        Atualiza um evento existente no Google Calendar.
        event_id: ID do evento a ser atualizado
        attendees: lista de e-mails para substituir os convidados atuais
        color: nome da cor (ex: 'vermelho', 'azul') ou colorId (1-11)
        Apenas os campos fornecidos serão atualizados (PATCH).
        """
        service = await self.get_service()
        if not service: return None

        patch_body = {}
        if summary is not None:
            patch_body['summary'] = summary
        if description is not None:
            patch_body['description'] = description
        if location is not None:
            patch_body['location'] = location
        if start_time is not None:
            patch_body['start'] = {'dateTime': start_time, 'timeZone': 'America/Sao_Paulo'}
        if end_time is not None:
            patch_body['end'] = {'dateTime': end_time, 'timeZone': 'America/Sao_Paulo'}
        if attendees is not None:
            emails = [a.strip() for a in attendees] if isinstance(attendees, list) else [a.strip() for a in str(attendees).split(',')]
            patch_body['attendees'] = [{'email': e} for e in emails if e]
        if recurrence is not None:
            rule = recurrence if recurrence.startswith('RRULE:') else f'RRULE:{recurrence}'
            patch_body['recurrence'] = [rule]
        color_id = resolve_color_id(color)
        if color_id:
            patch_body['colorId'] = color_id

        updated = service.events().patch(
            calendarId='primary', eventId=event_id, body=patch_body,
            sendUpdates='all'
        ).execute()
        return updated

    async def delete_event(self, event_id: str):
        """
        Remove um evento do Google Calendar.
        event_id: ID do evento a ser removido
        """
        service = await self.get_service()
        if not service: return False

        service.events().delete(calendarId='primary', eventId=event_id).execute()
        return True

    async def search_events(self, query: str, max_results=5):
        """
        Busca eventos por texto (título, descrição, local, participantes).
        query: termo de busca livre
        """
        service = await self.get_service()
        if not service: return []

        events_result = service.events().list(
            calendarId='primary',
            q=query,
            maxResults=max_results,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        return events_result.get('items', [])

    async def check_availability(self, start_time: str, end_time: str):
        """
        Verifica se o horário está livre ou ocupado usando a FreeBusy API.
        start_time: ISO format string do início do período a verificar
        end_time: ISO format string do fim do período a verificar
        Retorna: dict com 'livre' (bool), 'conflitos' (lista de eventos sobrepostos)
        """
        service = await self.get_service()
        if not service: return {'livre': None, 'erro': 'Sem conexão com Google Calendar'}

        body = {
            'timeMin': start_time,
            'timeMax': end_time,
            'timeZone': 'America/Sao_Paulo',
            'items': [{'id': 'primary'}]
        }
        freebusy = service.freebusy().query(body=body).execute()
        busy_slots = freebusy.get('calendars', {}).get('primary', {}).get('busy', [])

        return {
            'livre': len(busy_slots) == 0,
            'conflitos': busy_slots  # Lista de {'start': ..., 'end': ...} dos bloqueios
        }


# --- Mapa de cores do Google Calendar (nível de módulo) ---
# colorId: 1=Lavanda, 2=Sage/Verde, 3=Uva/Roxo, 4=Flamingo/Rosa, 5=Banana/Amarelo,
#          6=Tangerina/Laranja, 7=Pavão/Azul, 8=Grafite/Cinza,
#          9=Mirtilo/Azul Escuro, 10=Manjericão/Verde Escuro, 11=Tomate/Vermelho
GCAL_COLOR_MAP = {
    'vermelho': '11', 'red': '11', 'tomate': '11', 'tomato': '11',
    'rosa': '4', 'pink': '4', 'flamingo': '4',
    'laranja': '6', 'orange': '6', 'tangerina': '6', 'tangerine': '6',
    'amarelo': '5', 'yellow': '5', 'banana': '5',
    'verde': '2', 'green': '2', 'sage': '2',
    'verde escuro': '10', 'dark green': '10', 'basil': '10',
    'azul': '7', 'blue': '7', 'turquesa': '7', 'teal': '7', 'peacock': '7',
    'azul escuro': '9', 'dark blue': '9', 'mirtilo': '9', 'blueberry': '9', 'navy': '9',
    'roxo': '3', 'purple': '3', 'uva': '3', 'grape': '3', 'violeta': '3',
    'lavanda': '1', 'lavender': '1', 'lilas': '1',
    'cinza': '8', 'gray': '8', 'grey': '8', 'grafite': '8', 'graphite': '8',
}


def resolve_color_id(color_input):
    """Converte nome de cor (PT/EN) ou número string para colorId do Google Calendar."""
    if color_input is None:
        return None
    s = str(color_input).strip().lower()
    if s.isdigit() and 1 <= int(s) <= 11:
        return s
    for name in sorted(GCAL_COLOR_MAP, key=len, reverse=True):
        if name in s:
            return GCAL_COLOR_MAP[name]
    return None
