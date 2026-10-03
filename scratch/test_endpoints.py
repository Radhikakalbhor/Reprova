import requests

base = 'http://localhost:8000'
for pid in ['paper-llama2', 'paper-mistral7b', 'paper-clip']:
    g = requests.get(f'{base}/analyze/{pid}/graph').json()
    e = requests.post(f'{base}/analyze/{pid}/execute').json()
    m = requests.post(f'{base}/analyze/{pid}/execute-multi-seed').json()
    print(f"{pid}: graph_nodes={len(g.get('nodes', []))}, exec_status={e.get('status')}, multi_seed_supports={m.get('supports_multi_seed')}")
