/*
  Warnings:

  - A unique constraint covering the columns `[user_id,media_id]` on the table `Favorites` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,media_id]` on the table `Watchlist` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Favorites_user_id_media_id_key" ON "Favorites"("user_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_user_id_media_id_key" ON "Watchlist"("user_id", "media_id");
