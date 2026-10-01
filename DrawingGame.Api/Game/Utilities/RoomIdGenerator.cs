public static class RoomIdGenerator
{
    private const string Choices = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    public const int RoomIdLength = 6;

    public static string Generate()
    {
        return Random.Shared.GetString(Choices, RoomIdLength);
    }
}
