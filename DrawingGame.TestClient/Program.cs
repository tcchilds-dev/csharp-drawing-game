using System.Text.Json;
using Microsoft.AspNetCore.SignalR.Client;

var hubUrl = args.FirstOrDefault() ?? "http://localhost:5266/game";
var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
var firstWordChoices = new TaskCompletionSource<JsonElement>(
    TaskCreationOptions.RunContinuationsAsynchronously
);

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

    Console.WriteLine(
        "Press Enter to update the game settings as Host (both players should receive SyncRoom)."
    );
    Console.ReadLine();

    var settings = new
    {
        MaxPlayers = 6,
        WordSelectionSize = 5,
        WordChoiceTimeLimit = TimeSpan.FromSeconds(45),
        DrawTimeLimit = TimeSpan.FromSeconds(120),
        NumberOfRounds = 5,
    };
    Console.WriteLine(
        $"UpdateGameSettings sending:\n{JsonSerializer.Serialize(settings, jsonOptions)}"
    );
    await host.InvokeAsync("UpdateGameSettings", settings);
    Console.WriteLine("UpdateGameSettings completed; check the settings in the SyncRoom messages.");

    Console.WriteLine("Press Enter to send a message as Host (Guest should receive SyncRoom).");
    Console.ReadLine();

    var hostMessage = await host.InvokeAsync<JsonElement?>("SendMessage", "Hello from Host!");
    Console.WriteLine(
        $"[Host] SendMessage returned:\n{JsonSerializer.Serialize(hostMessage, jsonOptions)}"
    );

    Console.WriteLine("Press Enter to reply as Guest (Host should receive SyncRoom).");
    Console.ReadLine();

    var guestMessage = await guest.InvokeAsync<JsonElement?>("SendMessage", "Hello from Guest!");
    Console.WriteLine(
        $"[Guest] SendMessage returned:\n{JsonSerializer.Serialize(guestMessage, jsonOptions)}"
    );

    Console.WriteLine("Press Enter to start the game as Host and choose the first offered word.");
    Console.ReadLine();

    // The host is first in the room's turn order. Capture its private choices before
    // invoking StartGame, since SyncArtist can arrive before the invocation returns.
    await host.InvokeAsync("StartGame");
    var artistUpdate = await firstWordChoices.Task.WaitAsync(TimeSpan.FromSeconds(10));
    var word = artistUpdate.GetProperty("wordChoices")[0].GetString()
        ?? throw new InvalidOperationException("The API returned an empty word choice.");
    Console.WriteLine($"[Host] Choosing word: {word}");
    await host.InvokeAsync("ChooseWord", word);
    Console.WriteLine("ChooseWord completed; both players should receive the Drawing state.");

    Console.WriteLine(
        "Leave the client open to observe timed PhaseChange events and subsequent SyncArtist messages.\n"
        + "Press Enter to disconnect and exit."
    );
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
    connection.On<JsonElement>(
        "SyncArtist",
        update =>
        {
            Console.WriteLine(
                $"[{player}] SyncArtist received:\n{JsonSerializer.Serialize(update, jsonOptions)}"
            );
            if (player == "Host"
                && update.TryGetProperty("wordChoices", out var choices)
                && choices.ValueKind == JsonValueKind.Array
                && choices.GetArrayLength() > 0)
            {
                firstWordChoices.TrySetResult(update.Clone());
            }
        }
    );
    connection.On<JsonElement>(
        "PhaseChange",
        room => Console.WriteLine(
            $"[{player}] PhaseChange received:\n{JsonSerializer.Serialize(room, jsonOptions)}"
        )
    );
    connection.Closed += error =>
    {
        Console.WriteLine($"[{player}] Disconnected: {error?.Message ?? "connection closed"}");
        return Task.CompletedTask;
    };
    return connection;
}
