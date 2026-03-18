import urllib.request
import logging

try:
    req = urllib.request.Request('http://localhost:8000/integrations/google/provision-tools', method='POST')
    response = urllib.request.urlopen(req)
    print(response.read().decode('utf-8'))
except Exception as e:
    print(f'Error: {e}')
