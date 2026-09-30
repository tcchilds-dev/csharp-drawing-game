using DrawingGame.Api.Game;
using DrawingGame.Api.Game.Utilities;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
builder.Services.AddSingleton<RoomRegistry>();
builder.Services.AddHostedService<GameClock>();
builder.Services.AddSingleton<WordListManager>(_ =>
{
    var path = Path.Combine(AppContext.BaseDirectory, "word-list.txt");
    return new WordListManager(path);
});

var app = builder.Build();

app.UseDefaultFiles(); // "/" -> index.html
app.UseStaticFiles();

app.MapGet("/healthz", () => Results.Ok());
app.MapHub<GameHub>("/game");

app.Run();
