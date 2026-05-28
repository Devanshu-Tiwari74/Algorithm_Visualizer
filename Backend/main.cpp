#define ASIO_ENABLE_OLD_SERVICES 1
#include "crow.h"
#include <vector>
#include <algorithm>
#include <queue>
#include <iostream>

struct CORSHandler
{
    struct context
    {
    };
    void before_handle(crow::request &req, crow::response &res, context &ctx)
    {
    }
    void after_handle(crow::request &req, crow::response &res, context &ctx)
    {
        res.add_header("Access-Control-Allow-Origin", "*");
        res.add_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.add_header("Access-Control-Allow-Headers", "Content-Type");
    }
};

// Disjoint Set Union for Kruskal
struct DSU
{
    std::vector<int> parent, rank;
    DSU(int n)
    {
        parent.resize(n);
        rank.resize(n, 0);
        for (int i = 0; i < n; i++)
            parent[i] = i;
    }
    int find(int i)
    {
        if (parent[i] == i)
            return i;
        return parent[i] = find(parent[i]);
    }
    bool unite(int i, int j)
    {
        int root_i = find(i);
        int root_j = find(j);
        if (root_i != root_j)
        {
            if (rank[root_i] < rank[root_j])
                parent[root_i] = root_j;
            else if (rank[root_i] > rank[root_j])
                parent[root_j] = root_i;
            else
            {
                parent[root_j] = root_i;
                rank[root_i]++;
            }
            return true;
        }
        return false;
    }
};

int main()
{
    crow::App<CORSHandler> app;
    // Fractional Knapsack problem
    CROW_ROUTE(app, "/api/knapsack").methods(crow::HTTPMethod::Post, crow::HTTPMethod::Options)([](const crow::request &req)
                                                                                                {
        if (req.method == crow::HTTPMethod::Options) return crow::response(204);
        auto body = crow::json::load(req.body);
        if (!body) return crow::response(400);

        int capacity = body["capacity"].i();
        auto items = body["items"];
        
        struct Item { int value, weight; double ratio; };
        std::vector<Item> v;
        for (auto& item : items) {
            const int value = static_cast<int>(item["value"].i());
            const int weight = static_cast<int>(item["weight"].i());
            v.push_back(Item{value, weight, static_cast<double>(value) / weight});
        }
        std::sort(v.begin(), v.end(), [](const Item& a, const Item& b) { return a.ratio > b.ratio; });
        
        double totalValue = 0;
        int currentWeight = 0;
        crow::json::wvalue res;
        for (const auto& item : v) {
            if (currentWeight + item.weight <= capacity) {
                currentWeight += item.weight;
                totalValue += item.value;
            } else {
                int remain = capacity - currentWeight;
                totalValue += item.value * ((double)remain / item.weight);
                break;
            }
        }
        res["totalValue"] = totalValue;
        return crow::response(res); });

    // Dijkstra's algorithm
    CROW_ROUTE(app, "/api/dijkstra").methods(crow::HTTPMethod::Post, crow::HTTPMethod::Options)([](const crow::request &req)
                                                                                                {
        if (req.method == crow::HTTPMethod::Options) return crow::response(204);
        auto body = crow::json::load(req.body);
        if (!body) return crow::response(400);

        int vertices = body["vertices"].i();
        int source = body["source"].i();
        auto edges = body["edges"];

        std::vector<std::vector<std::pair<int, int>>> adj(vertices);
        for (auto& edge : edges) {
            adj[edge["u"].i()].push_back({edge["v"].i(), edge["w"].i()});
            adj[edge["v"].i()].push_back({edge["u"].i(), edge["w"].i()}); // Assuming undirected
        }

        std::vector<int> dist(vertices, 1e9);
        dist[source] = 0;
        std::priority_queue<std::pair<int, int>, std::vector<std::pair<int, int>>, std::greater<>> pq;
        pq.push({0, source});

        while (!pq.empty()) {
            int u = pq.top().second;
            int d = pq.top().first;
            pq.pop();
            if (d > dist[u]) continue;
            for (auto& edge : adj[u]) {
                int v = edge.first;
                int weight = edge.second;
                if (dist[u] + weight < dist[v]) {
                    dist[v] = dist[u] + weight;
                    pq.push({dist[v], v});
                }
            }
        }

        crow::json::wvalue res;
        for (int i = 0; i < vertices; i++) {
            res["distances"][i] = dist[i] == 1e9 ? -1 : dist[i];
        }
        return crow::response(res); });

    // Bellman-Ford algorithm
    CROW_ROUTE(app, "/api/bellmanford").methods(crow::HTTPMethod::Post, crow::HTTPMethod::Options)([](const crow::request &req)
                                                                                                   {
        if (req.method == crow::HTTPMethod::Options) return crow::response(204);
        auto body = crow::json::load(req.body);
        if (!body) return crow::response(400);

        int vertices = body["vertices"].i();
        int source = body["source"].i();
        auto edges = body["edges"];

        std::vector<int> dist(vertices, 1e9);
        dist[source] = 0;

        for (int i = 1; i <= vertices - 1; i++) {
            for (auto& edge : edges) {
                int u = edge["u"].i();
                int v = edge["v"].i();
                int w = edge["w"].i();
                if (dist[u] != 1e9 && dist[u] + w < dist[v]) {
                    dist[v] = dist[u] + w;
                }
            }
        }

        crow::json::wvalue res;
        for (int i = 0; i < vertices; i++) {
            res["distances"][i] = dist[i] == 1e9 ? -1 : dist[i];
        }
        return crow::response(res); });

    // Prim's algorithm
    CROW_ROUTE(app, "/api/prim").methods(crow::HTTPMethod::Post, crow::HTTPMethod::Options)([](const crow::request &req)
                                                                                            {
        if (req.method == crow::HTTPMethod::Options) return crow::response(204);
        auto body = crow::json::load(req.body);
        if (!body) return crow::response(400);

        int vertices = body["vertices"].i();
        auto edges = body["edges"];

        std::vector<std::vector<std::pair<int, int>>> adj(vertices);
        for (auto& edge : edges) {
            adj[edge["u"].i()].push_back({edge["v"].i(), edge["w"].i()});
            adj[edge["v"].i()].push_back({edge["u"].i(), edge["w"].i()});
        }

        std::vector<bool> inMST(vertices, false);
        std::vector<int> parent(vertices, -1);
        std::priority_queue<std::pair<int, std::pair<int, int>>, std::vector<std::pair<int, std::pair<int, int>>>, std::greater<>> pq;
        int totalWeight = 0;
        
        crow::json::wvalue res;
        int edgeCount = 0;

        // start from 0
        if (vertices > 0) pq.push({0, {0, -1}});

        while (!pq.empty()) {
            auto top = pq.top();
            pq.pop();
            int w = top.first;
            int u = top.second.first;
            int p = top.second.second;

            if (inMST[u]) continue;
            inMST[u] = true;
            totalWeight += w;

            if (p != -1) {
                res["mst_edges"][edgeCount]["u"] = p;
                res["mst_edges"][edgeCount]["v"] = u;
                res["mst_edges"][edgeCount]["w"] = w;
                edgeCount++;
            }

            for (auto& edge : adj[u]) {
                int v = edge.first;
                int weight = edge.second;
                if (!inMST[v]) {
                    pq.push({weight, {v, u}});
                }
            }
        }
        res["totalWeight"] = totalWeight;
        return crow::response(res); });

    // kruskal's algorithm
    CROW_ROUTE(app, "/api/kruskal").methods(crow::HTTPMethod::Post, crow::HTTPMethod::Options)([](const crow::request &req)
                                                                                               {
        if (req.method == crow::HTTPMethod::Options) return crow::response(204);
        auto body = crow::json::load(req.body);
        if (!body) return crow::response(400);

        int vertices = body["vertices"].i();
        auto edges_json = body["edges"];

        struct Edge { int u, v, w; };
        std::vector<Edge> edges;
        for (auto& edge : edges_json) {
            const int u = static_cast<int>(edge["u"].i());
            const int v = static_cast<int>(edge["v"].i());
            const int w = static_cast<int>(edge["w"].i());
            edges.push_back(Edge{u, v, w});
        }

        std::sort(edges.begin(), edges.end(), [](const Edge& a, const Edge& b) { return a.w < b.w; });

        DSU dsu(vertices);
        int totalWeight = 0;
        crow::json::wvalue res;
        int edgeCount = 0;

        for (auto& edge : edges) {
            if (dsu.unite(edge.u, edge.v)) {
                totalWeight += edge.w;
                res["mst_edges"][edgeCount]["u"] = edge.u;
                res["mst_edges"][edgeCount]["v"] = edge.v;
                res["mst_edges"][edgeCount]["w"] = edge.w;
                edgeCount++;
            }
        }
        res["totalWeight"] = totalWeight;
        return crow::response(res); });

    // Activity Selection Problem
    CROW_ROUTE(app, "/api/activity").methods(crow::HTTPMethod::Post, crow::HTTPMethod::Options)([](const crow::request &req)
                                                                                                {
        if (req.method == crow::HTTPMethod::Options) return crow::response(204);
        auto body = crow::json::load(req.body);
        if (!body) return crow::response(400);

        auto activities_json = body["activities"];
        struct Activity { int start, finish; };
        std::vector<Activity> acts;
        for (auto& a : activities_json) {
            const int start = static_cast<int>(a["start"].i());
            const int finish = static_cast<int>(a["finish"].i());
            acts.push_back(Activity{start, finish});
        }

        std::sort(acts.begin(), acts.end(), [](const Activity& a, const Activity& b) { return a.finish < b.finish; });

        crow::json::wvalue res;
        int count = 0;
        int last_finish = -1;

        for (auto& a : acts) {
            if (a.start >= last_finish) {
                res["selected"][count]["start"] = a.start;
                res["selected"][count]["finish"] = a.finish;
                last_finish = a.finish;
                count++;
            }
        }
        res["count"] = count;
        return crow::response(res); });

    // Matrix Chain Multiplication
    CROW_ROUTE(app, "/api/mcm").methods(crow::HTTPMethod::Post, crow::HTTPMethod::Options)([](const crow::request &req)
                                                                                           {
        if (req.method == crow::HTTPMethod::Options) return crow::response(204);
        auto body = crow::json::load(req.body);
        if (!body) return crow::response(400);

        auto p_json = body["dimensions"];
        std::vector<int> p;
        for (auto& dim : p_json) {
            p.push_back(dim.i());
        }

        int n = p.size();
        if (n < 2) return crow::response(400);

        std::vector<std::vector<int>> m(n, std::vector<int>(n, 0));
        std::vector<std::vector<int>> s(n, std::vector<int>(n, 0));

        for (int L = 2; L < n; L++) {
            for (int i = 1; i < n - L + 1; i++) {
                int j = i + L - 1;
                m[i][j] = 1e9;
                for (int k = i; k <= j - 1; k++) {
                    int q = m[i][k] + m[k + 1][j] + p[i - 1] * p[k] * p[j];
                    if (q < m[i][j]) {
                        m[i][j] = q;
                        s[i][j] = k;
                    }
                }
            }
        }

        crow::json::wvalue res;
        res["minCost"] = m[1][n - 1];
        return crow::response(res); });

    app.port(18080).multithreaded().run();
}
