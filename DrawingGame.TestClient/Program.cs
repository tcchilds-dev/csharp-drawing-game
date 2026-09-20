using System.Text.Json;
using Microsoft.AspNetCore.SignalR.Client;

var hubUrl = args.FirstOrDefault() ?? "http://localhost:5266/game";
var jsonOptions = new JsonSerializerOptions { WriteIndented = true };

await using var host = CreateConnection("Host");
await using var guest = CreateConnection("Guest");

try
{
    await host.StartAsync();
    Console.WriteLine($"Host connected to {hubUrl}");

    var created = await host.InvokeAsync<JsonElement>("CreateRoom", "Host");
    Console.WriteLine($"CreateRoom returned:\n{JsonSerializer.Serialize(created, jsonOptions)}");
    var roomId = created.GetProperty("session").GetProperty("roomId").GetString()!;

    Console.WriteLine("Press Enter to join the room with a second player.");
    Console.ReadLine();

    await guest.StartAsync();
    Console.WriteLine("Guest connected");
    var joined = await guest.InvokeAsync<JsonElement>("JoinRoom", "Guest", roomId);
    Console.WriteLine($"JoinRoom returned:\n{JsonSerializer.Serialize(joined, jsonOptions)}");

    Console.WriteLine("Press Enter to disconnect and exit.");
    Console.ReadLine();
}
catch (Exception exception)
{
    Console.Error.WriteLine($"Smoke test failed: {exception.Message}");
    Environment.ExitCode = 1;
}

HubConnection CreateConnection(string player)
{
    var connection = new HubConnectionBuilder().WithUrl(hubUrl).Build();
    connection.On<JsonElement>(
        "SyncRoom",
        room =>
            Console.WriteLine(
                $"[{player}] SyncRoom received:\n{JsonSerializer.Serialize(room, jsonOptions)}"
            )
    );
    connection.Closed += error =>
    {
        Console.WriteLine($"[{player}] Disconnected: {error?.Message ?? "connection closed"}");
        return Task.CompletedTask;
    };
    return connection;
}
