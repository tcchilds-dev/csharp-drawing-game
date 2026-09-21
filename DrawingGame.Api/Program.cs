using DrawingGame.Api.Game;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
builder.Services.AddSingleton<RoomRegistry>();

var app = builder.Build();

app.UseHttpsRedirection();
app.MapHub<GameHub>("/game");

app.Run();
