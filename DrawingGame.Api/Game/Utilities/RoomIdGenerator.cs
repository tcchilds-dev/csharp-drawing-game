public static class RoomIdGenerator
{
    private const string Choices = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
    public const int RoomIdLength = 6;

    public static string Generate()
    {
        return Random.Shared.GetString(Choices, RoomIdLength);
    }
}
